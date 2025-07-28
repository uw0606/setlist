// =============================================================================
// グローバル変数とDOM要素の参照
// =============================================================================

let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムID (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
let touchTimeout = null; // setTimeout のIDを保持する変数
let touchDragTimeout = null; // ドラッグ開始のsetTimeout ID
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap
let originalSetlistSlot = null; // PCドラッグで、セットリスト内でドラッグ開始された「元のスロット要素」を指す (DOM要素)

// モバイルタッチドラッグの状態を保持するオブジェクト
const currentDraggingItem = {
    draggedElement: null, // ドラッグ中の元のDOM要素 (setlist-item または album .item)
    originalSourceSlot: -1 // セットリスト内からのドラッグの場合、元のスロットのインデックス (数値)。アルバムからの場合は -1。
};

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26; // セットリストの最大曲数

let currentDropZone = null;
let activeTouchSlot = null; // モバイルでのドロップゾーンハイライト用
let rafId = null; // requestAnimationFrame のID

// アルバム1として扱うdata-item-idのリスト（共有テキスト、PDF生成時に使用）
const album1ItemIds = [
    'album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006',
    'album1-007', 'album1-008', 'album1-009', 'album1-010', 'album1-011',
    'album1-003', 'album1-012', 'album1-013'
];

// 仮のsongDataリポジトリ (実際のデータソースに置き換えてください)
const allSongsData = {
    'album1-001': { name: '曲名A', hasShortOption: true, hasSeOption: false, hasDrumsoloOption: false, rGt: 'D', lGt: 'D', bass: 'D', bpm: '160', chorus: 'true', albumClass: 'album1' },
    'album1-002': { name: '曲名B', hasShortOption: false, hasSeOption: true, hasDrumsoloOption: false, rGt: 'C', lGt: 'C', bass: 'C', bpm: '120', chorus: 'false', albumClass: 'album1' },
    'album1-003': { name: '曲名C', hasShortOption: true, hasSeOption: true, hasDrumsoloOption: true, rGt: 'E', lGt: 'E', bass: 'E', bpm: '180', chorus: 'true', albumClass: 'album1' },
    'album2-001': { name: 'アルバム2曲A', hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false, rGt: 'Std', lGt: 'Std', bass: 'Std', bpm: '130', chorus: 'false', albumClass: 'album2' },
    // 必要に応じて他の曲データをここに追加
};


// Firebaseの初期化（これはHTMLまたは別のJSファイルで一度だけ行う必要があります）
// 例:
// if (typeof firebase !== 'undefined' && firebaseConfig) {
//     firebase.initializeApp(firebaseConfig);
//     var database = firebase.database();
// }

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * アイテムIDに基づいて曲のデータを取得するヘルパー関数。
 * @param {string} itemId - 曲のユニークなID。
 * @returns {object|null} 曲のデータオブジェクト、またはnull。
 */
function getSongDataById(itemId) {
    const song = allSongsData[itemId];
    if (song) {
        return { ...song, itemId: itemId };
    }
    console.warn(`[getSongDataById] Song data not found for itemId: ${itemId}`);
    return null;
}

/**
 * HTML要素のデータ属性から曲の情報を取得する。
 * @param {HTMLElement} element - セットリストアイテムまたはアルバムアイテムのHTML要素。
 * @returns {object|null} 曲のデータを含むオブジェクト、またはnull。
 */
function getSlotItemData(element) {
    if (!element || !element.dataset) {
        console.warn("[getSlotItemData] Invalid element provided or no dataset.");
        return null;
    }
    // datasetから直接データを取得
    const data = element.dataset;
    return {
        itemId: data.itemId || null,
        name: data.songName || null,
        // boolean は文字列として保存されているので変換
        hasShortOption: data.isShortVersion === 'true',
        hasSeOption: data.hasSeOption === 'true',
        hasDrumsoloOption: data.drumsoloOption === 'true',
        rGt: data.rGt || '',
        lGt: data.lGt || '',
        bass: data.bass || '',
        bpm: data.bpm || '',
        chorus: data.chorus || 'false', // 文字列のまま
        short: data.short === 'true', // 現在のチェック状態
        seChecked: data.seChecked === 'true', // 現在のチェック状態
        drumsoloChecked: data.drumsoloChecked === 'true', // 現在のチェック状態
        albumClass: Array.from(element.classList).find(cls => cls.startsWith('album')) || null
    };
}


/**
 * チェックボックスとそのラベルのラッパー要素を作成するヘルパー関数。
 * @param {string} labelText - チェックボックスのラベルテキスト。
 * @param {boolean} isChecked - チェックボックスがチェックされているか。
 * @param {function} onChangeHandler - チェックボックスの状態が変更されたときに呼び出すハンドラ。
 * @returns {HTMLElement} 作成されたラッパー要素。
 */
function createCheckboxWrapper(labelText, isChecked, onChangeHandler) {
    const wrapper = document.createElement('label');
    wrapper.classList.add('checkbox-wrapper');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.addEventListener('change', onChangeHandler);

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    return wrapper;
}


/**
 * セットリストスロットの内容を更新（曲名とオプションの表示）。
 * @param {HTMLElement} slotElement - 更新するセットリストスロット要素。
 * @param {string} songName - 表示する曲名。
 * @param {Object} options - 曲のオプション。
 * - `isShortVersion`: 短縮版オプションが「存在しうるか」 (boolean)
 * - `hasSeOption`: SEオプションが「存在しうるか」 (boolean)
 * - `drumsoloOption`: ドラムソロオプションが「存在しうるか」 (boolean)
 * - `rGt`, `lGt`, `bass`, `bpm`: チューニングやBPMの文字列
 * - `chorus`: コーラス情報 ('true'/'false'文字列)
 * - `short`: 短縮版が「現在チェックされているか」 (boolean)
 * - `seChecked`: SEが「現在チェックされているか」 (boolean)
 * - `drumsoloChecked`: ドラムソロが「現在チェックされているか」 (boolean)
 */
function updateSlotContent(slotElement, songName, options) {
    // 既存のコンテンツをクリア
    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }

    // slotElementのdatasetも更新
    slotElement.dataset.songName = songName;
    slotElement.dataset.isShortVersion = options.isShortVersion ? 'true' : 'false';
    slotElement.dataset.hasSeOption = options.hasSeOption ? 'true' : 'false';
    slotElement.dataset.drumsoloOption = options.drumsoloOption ? 'true' : 'false';
    slotElement.dataset.rGt = options.rGt || '';
    slotElement.dataset.lGt = options.lGt || '';
    slotElement.dataset.bass = options.bass || '';
    slotElement.dataset.bpm = options.bpm || '';
    slotElement.dataset.chorus = options.chorus || 'false';
    // 現在のチェック状態もdatasetに反映
    slotElement.dataset.short = options.short ? 'true' : 'false';
    slotElement.dataset.seChecked = options.seChecked ? 'true' : 'false';
    slotElement.dataset.drumsoloChecked = options.drumsoloChecked ? 'true' : 'false';

    // song-info-container を作成
    const songInfoContainer = document.createElement('div');
    songInfoContainer.classList.add('song-info-container');

    // song-name-and-option を作成
    const songNameAndOption = document.createElement('div');
    songNameAndOption.classList.add('song-name-and-option');

    // 曲名要素
    const songNameSpan = document.createElement('span');
    songNameSpan.textContent = songName;
    songNameSpan.classList.add('song-name');
    songNameAndOption.appendChild(songNameSpan);

    // オプション要素 (チェックボックス) をラップするコンテナ
    const itemOptions = document.createElement('div');
    itemOptions.classList.add('item-options');

    let hasAnyCheckboxOption = false;

    // 短縮版
    if (options.isShortVersion) {
        hasAnyCheckboxOption = true;
        const shortVersionCheckboxWrapper = createCheckboxWrapper('短縮', options.short, (e) => {
            slotElement.dataset.short = e.target.checked.toString();
            slotElement.classList.toggle('short', e.target.checked);
            console.log(`[updateSlotContent:change:short] Slot ${slotElement.dataset.slotIndex} short status changed to: ${e.target.checked}`);
        });
        shortVersionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'short';
        itemOptions.appendChild(shortVersionCheckboxWrapper);
    }

    // SE有無
    if (options.hasSeOption) {
        hasAnyCheckboxOption = true;
        const seOptionCheckboxWrapper = createCheckboxWrapper('SE', options.seChecked, (e) => {
            slotElement.dataset.seChecked = e.target.checked.toString();
            slotElement.classList.toggle('se-active', e.target.checked);
            console.log(`[updateSlotContent:change:se] Slot ${slotElement.dataset.slotIndex} SE status changed to: ${e.target.checked}`);
        });
        seOptionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'se';
        itemOptions.appendChild(seOptionCheckboxWrapper);
    }

    // ドラムソロ有無
    if (options.drumsoloOption) {
        hasAnyCheckboxOption = true;
        const drumsoloOptionCheckboxWrapper = createCheckboxWrapper('ドラムソロ', options.drumsoloChecked, (e) => {
            slotElement.dataset.drumsoloChecked = e.target.checked.toString();
            slotElement.classList.toggle('drumsolo-active', e.target.checked);
            console.log(`[updateSlotContent:change:drumsolo] Slot ${slotElement.dataset.slotIndex} drumsolo status changed to: ${e.target.checked}`);
        });
        drumsoloOptionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'drumsolo';
        itemOptions.appendChild(drumsoloOptionCheckboxWrapper);
    }
    
    if (hasAnyCheckboxOption) {
        songNameAndOption.appendChild(itemOptions);
    }

    songInfoContainer.appendChild(songNameAndOption);

    // Additional Song Info (チューニング, BPM, コーラス)
    const additionalInfoDiv = document.createElement('div');
    additionalInfoDiv.classList.add('additional-song-info');
    
    let infoParts = [];
    if (options.rGt) infoParts.push(`R.GT: ${options.rGt}`);
    if (options.lGt) infoParts.push(`L.GT: ${options.lGt}`);
    if (options.bass) infoParts.push(`Ba: ${options.bass}`);
    if (options.bpm) infoParts.push(`BPM: ${options.bpm}`);
    if (options.chorus === 'true') infoParts.push(`コーラス`); 

    if (infoParts.length > 0) {
        additionalInfoDiv.textContent = infoParts.join(' | ');
        songInfoContainer.appendChild(additionalInfoDiv);
    }

    slotElement.appendChild(songInfoContainer);

    // ドラッグハンドルの追加 (右端)
    const dragHandle = document.createElement('span');
    dragHandle.classList.add('drag-handle');
    dragHandle.textContent = '☰';
    slotElement.appendChild(dragHandle);

    // スロット自体に適切なクラスを追加
    slotElement.classList.add('setlist-item');
    slotElement.style.pointerEvents = 'auto'; // アイテムが入ったらドラッグ可能にする
    slotElement.style.touchAction = 'pan-y'; // タッチスクロールを許可しつつ、ドラッグも可能にする
}


/**
 * 指定されたセットリストのスロットからアイテムをクリアする。
 * @param {number} slotIndex - クリアするセットリストのスロットのインデックス。
 */
function clearSlotContent(slotIndex) {
    if (slotIndex === null || isNaN(slotIndex)) {
        console.error(`[clearSlotContent] Invalid slotIndex received: ${slotIndex}. Aborting clear.`);
        return;
    }
    const slotElement = document.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (slotElement) {
        // setlist-item クラスを削除してスロットを空の状態に戻す
        slotElement.classList.remove('setlist-item', 'short', 'se-active', 'drumsolo-active'); // オプションクラスも削除
        // dataset もクリア
        for (const key in slotElement.dataset) {
            delete slotElement.dataset[key];
        }
        // HTMLコンテンツをクリア
        slotElement.innerHTML = `<span class="slot-number">${slotIndex + 1}.</span><span class="song-info"></span>`;
        slotElement.style.pointerEvents = 'auto'; // 空になってもドロップターゲットとして機能させる
        slotElement.style.touchAction = 'none'; // 空のスロットはスクロールさせない
        console.log(`[clearSlotContent] Slot ${slotIndex} cleared successfully.`);
    } else {
        console.warn(`[clearSlotContent] Slot element not found for index: ${slotIndex}`);
    }
}

/**
 * セットリストから曲を削除し、アルバムリストに「戻す」処理 (実際にはセットリストから削除するだけ)。
 * @param {HTMLElement} setlistItem - セットリストから削除するHTML要素。
 */
function restoreToOriginalList(setlistItem) {
    if (!setlistItem || !setlistItem.classList.contains('setlist-item')) {
        console.warn("[restoreToOriginalList] Invalid element passed or element is not a setlist item. Cannot restore.");
        return;
    }

    const slotIndex = parseInt(setlistItem.dataset.slotIndex, 10);
    const itemId = setlistItem.dataset.itemId;

    console.log(`[restoreToOriginalList] Restoring item ${itemId} from slot ${slotIndex} to original list.`);

    clearSlotContent(slotIndex);

    hideSetlistItemsInMenu(); 

    showMessage("セットリストから曲を削除しました。", "success");
}

/**
 * スロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 */
function fillSlotWithItem(slotElement, songData) {
    console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
    console.log(`[fillSlotWithItem] songData received:`, songData);

    // addSongToSlot を呼び出して、すべての設定とイベントリスナーを一度に行う
    addSongToSlot(slotElement, songData.itemId, songData.name, {
        isShortVersion: songData.hasShortOption,
        hasSeOption: songData.hasSeOption,
        drumsoloOption: songData.hasDrumsoloOption,
        rGt: songData.rGt,
        lGt: songData.lGt,
        bass: songData.bass,
        bpm: songData.bpm,
        chorus: songData.chorus,
        short: songData.short, 
        seChecked: songData.seChecked,
        drumsoloChecked: songData.drumsoloChecked
    }, songData.albumClass);
}

/**
 * セットリストの指定されたスロットに曲を追加する。
 * @param {HTMLElement} slotElement - 曲を追加するセットリストのスロット要素。
 * @param {string} itemId - 曲のユニークなID。
 * @param {string} songName - 曲名。
 * @param {Object} options - 曲のオプション。
 * - `isShortVersion`: 短縮版オプションが「存在しうるか」 (boolean)
 * - `hasSeOption`: SEオプションが「存在しうるか」 (boolean)
 * - `drumsoloOption`: ドラムソロオプションが「存在しうるか` (boolean)
 * - `rGt`, `lGt`, `bass`, `bpm`: チューニングやBPMの文字列
 * - `chorus`: コーラス情報 ('true'/'false'文字列)
 * - `short`: 短縮版が「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `seChecked`: SEが「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `drumsoloChecked`: ドラムソロが「現在チェックされているか` (boolean, 初回追加時はfalse)
 * @param {string} albumClass - 曲が属するアルバムのクラス名 (例: 'album1', 'album2')。
 */
function addSongToSlot(slotElement, itemId, songName, options, albumClass) {
    const slotIndex = parseInt(slotElement.dataset.slotIndex, 10);
    if (isNaN(slotIndex)) {
        console.error(`[addSongToSlot] Invalid slotIndex on slotElement: ${slotElement.dataset.slotIndex}. Aborting add.`);
        return;
    }
    console.log(`[addSongToSlot] Adding song ${songName} (${itemId}) to slot ${slotIndex}. Album: ${albumClass}`);
    console.log('[addSongToSlot] Options received:', options);

    // 既存のコンテンツをクリア (updateSlotContentがクリアするのでここでは不要だが、念のため)
    const existingItem = slotElement.querySelector('.setlist-item');
    if (existingItem) {
        existingItem.remove();
    }

    // slotElementにdata属性を設定
    slotElement.dataset.itemId = itemId;
    // slotElementにアルバムクラスを追加
    if (albumClass) { // albumClass が null や undefined でないことを確認
        slotElement.classList.add(albumClass);
    }
    // slotElementに setlist-item クラスを追加
    slotElement.classList.add('setlist-item');

    // updateSlotContent を呼び出してコンテンツとチェックボックスをセットアップ
    updateSlotContent(slotElement, songName, options);

    // enableDragAndDrop を呼び出して、スロットにイベントリスナーを再設定
    enableDragAndDrop(slotElement);

    // スロットがアイテムを持つようになったら pointer-events を auto に設定
    slotElement.style.pointerEvents = 'auto';
    slotElement.style.touchAction = 'pan-y'; // ドラッグと縦スクロールを両立

    // セットリストの内部データ構造を更新 (この関数は外部で定義されている想定)
    // updateSetlistData(slotIndex, itemId, options, albumClass); 

    console.log(`[addSongToSlot] Successfully added song ${songName} to slot ${slotIndex}.`);
}


/**
 * セットリストの内部データ構造を更新する関数。
 * この関数は、実際のアプリケーションのデータ構造に応じて実装する必要があります。
 * 例:
 * let currentSetlist = []; // グローバル変数またはVue/Reactの状態
 * function updateSetlistData(slotIndex, itemId, options, albumClass) {
 * currentSetlist[slotIndex] = {
 * itemId: itemId,
 * name: getSongDataById(itemId).name, // itemIdから名前を取得
 * isShortVersion: options.isShortVersion,
 * hasSeOption: options.hasSeOption,
 * drumsoloOption: options.drumsoloOption,
 * rGt: options.rGt,
 * lGt: options.lGt,
 * bass: options.bass,
 * bpm: options.bpm,
 * chorus: options.chorus,
 * short: options.short,
 * seChecked: options.seChecked,
 * drumsoloChecked: options.drumsoloChecked,
 * albumClass: albumClass,
 * slotIndex: slotIndex // slotIndexも保存
 * };
 * // 必要に応じて、currentSetlist を Firebase などに保存する処理を呼び出す
 * }
 * function clearSetlistData(slotIndex) {
 * currentSetlist[slotIndex] = null;
 * }
 */
function updateSetlistData(slotIndex, itemId, options, albumClass) {
    // この関数はアプリケーションのデータ管理ロジックに依存します
    // ここではダミーのログを出力
    console.log(`[updateSetlistData] Data for slot ${slotIndex} updated to: ${itemId}`);
}
function clearSetlistData(slotIndex) {
    console.log(`[clearSetlistData] Data for slot ${slotIndex} cleared.`);
}


// =============================================================================
// ドラッグ＆ドロップイベントハンドラ
// =============================================================================

/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
    const originalElement = event.target.closest(".item") || event.target.closest(".setlist-item");
    if (!originalElement) {
        console.warn("[dragstart:PC] No draggable item found. Aborting drag.");
        event.preventDefault(); // ドラッグをキャンセル
        return;
    }

    // ドラッグ対象がチェックボックスの場合は通常の動作を許可
    if (event.target.type === 'checkbox') {
        console.log('[dragstart:PC] Touched checkbox. Preventing default drag behavior.');
        return;
    }

    draggingItemId = originalElement.dataset.itemId;
    event.dataTransfer.setData("text/plain", draggingItemId);
    event.dataTransfer.effectAllowed = "move";

    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement; // DOM要素として保持
        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot'); // PC用プレースホルダークラス
        console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
    } else {
        originalSetlistSlot = null; // アルバムからのドラッグ
        console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId}.`);
    }

    // 元のアルバムリスト情報を記録（既に存在する場合は更新しない）
    if (!originalAlbumMap.has(draggingItemId)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(draggingItemId, originalListId);
        console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
    } else {
        console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
    }
    console.log(`[dragstart] dataTransfer set with: ${draggingItemId}`);
}


/**
 * ドラッグオーバー時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault(); // ドロップを許可するために必要
    event.dataTransfer.dropEffect = "move";

    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        // 現在ドラッグオーバーしているスロットが、自身の元のスロットではないことを確認
        const isSelfSlot = originalSetlistSlot && targetSlot === originalSetlistSlot;
        
        if (!isSelfSlot && currentDropZone !== targetSlot) {
            // 前のハイライトをクリア
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            // 新しいスロットをハイライト
            targetSlot.classList.add('drag-over');
            currentDropZone = targetSlot;
        } else if (isSelfSlot && currentDropZone) {
            // 自身のスロットにドラッグオーバーしている場合はハイライトをクリア
            currentDropZone.classList.remove('drag-over');
            currentDropZone = null;
        }
    } else {
        // スロット外にドラッグオーバーした場合、ハイライトをクリア
        if (currentDropZone) {
            currentDropZone.classList.remove('drag-over');
            currentDropZone = null;
        }
    }
}


/**
 * ドラッグエンター時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragEnter(event) {
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        // handleDragOverでハイライト処理を行うため、ここでは特に何もしない
    }
}


/**
 * ドラッグリーブ時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
    const targetSlot = event.target.closest('.setlist-slot');
    // ドラッグリーブが、実際にスロット要素の外に出たときにのみ発生するように調整
    if (targetSlot && !targetSlot.contains(event.relatedTarget)) {
        targetSlot.classList.remove('drag-over');
        if (currentDropZone === targetSlot) {
            currentDropZone = null;
        }
    }
}


/**
 * ドロップ時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
    event.preventDefault();
    console.log("[handleDrop] Drop event fired (PC).");
    const droppedItemId = event.dataTransfer.getData("text/plain");
    console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

    let draggedItemElement;
    // originalSetlistSlot は DOM 要素なので、ここからデータを取得
    if (originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId) {
        draggedItemElement = originalSetlistSlot;
    } else {
        // アルバムアイテムの場合
        draggedItemElement = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
    }

    if (!draggedItemElement) {
        console.error("[handleDrop] draggedItemElement not found in DOM with itemId:", droppedItemId, ". Aborting.");
        finishDragging();
        return;
    }
    console.log("[handleDrop] draggedItemElement found:", draggedItemElement);

    const dropTargetSlot = event.target.closest('.setlist-slot');
    if (!dropTargetSlot) {
        console.warn("[handleDrop] No valid drop target slot found. Aborting drop.");
        finishDragging();
        return;
    }
    const dropTargetSlotIndex = parseInt(dropTargetSlot.dataset.slotIndex, 10);
    console.log("[handleDrop] dropTargetSlotIndex:", dropTargetSlotIndex);

    const originalSourceSlotIndex = originalSetlistSlot ? parseInt(originalSetlistSlot.dataset.slotIndex, 10) : -1;

    processDrop(draggedItemElement, dropTargetSlotIndex, originalSourceSlotIndex);
    finishDragging(); // ドロップ処理後に必ずクリーンアップ
}


/**
 * タッチ開始時の処理 (モバイル向け)。
 */
function handleTouchStart(event) {
    const touchedElement = event.target.closest('.setlist-item, .setlist-slot, .item');

    if (!touchedElement) {
        console.log('[touchstart:Mobile] Touched element not relevant for drag/double-click.');
        return;
    }

    // チェックボックスの場合は通常の動作を許可
    if (event.target.type === 'checkbox') {
        console.log('[touchstart:Mobile] Touched checkbox. Preventing default drag behavior.');
        return;
    }

    // ドラッグ対象要素が setlist-item または album .item かつ draggable="true" を持っていることを確認
    if ((touchedElement.classList.contains('setlist-item') || touchedElement.classList.contains('item')) && touchedElement.draggable) {
        event.preventDefault(); // デフォルトのスクロール動作などを防ぐ

        // タッチ開始位置を記録
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        // currentDraggingItem に情報をセット
        currentDraggingItem.draggedElement = touchedElement; // DOM要素をそのまま保持
        if (touchedElement.classList.contains('setlist-item')) {
            currentDraggingItem.originalSourceSlot = parseInt(touchedElement.dataset.slotIndex, 10);
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${currentDraggingItem.originalSourceSlot}`);
        } else {
            currentDraggingItem.originalSourceSlot = -1; // アルバムからのドラッグ
            console.log(`[touchstart:Mobile] Dragging from album.`);
        }

        // ドラッグ開始のためのタイマーを設定
        // 短時間での離脱（タップ）と長押し（ドラッグ）を区別
        touchDragTimeout = setTimeout(() => {
            if (currentDraggingItem.draggedElement) {
                // clone の作成と original の非表示
                createTouchDraggedClone(currentDraggingItem.draggedElement, touchStartX, touchStartY);
                
                if (currentDraggingItem.originalSourceSlot !== -1) {
                    // オリジナルのスロットを隠し、プレースホルダーとしてマーク (セットリストからのドラッグの場合のみ)
                    const originalSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${currentDraggingItem.originalSourceSlot}"]`);
                    if (originalSlotElement) {
                        originalSlotElement.style.visibility = 'hidden';
                        originalSlotElement.classList.add('placeholder'); // モバイル用プレースホルダークラス
                        console.log(`[touchstart:Mobile] Original setlist slot ${currentDraggingItem.originalSourceSlot} hidden and marked as placeholder.`);
                    }
                }
                isDragging = true;
                console.log('[touchstart:Mobile] Dragging initiated after timeout. Clone created and original hidden/not hidden.');
            } else {
                console.warn('[touchstart:Mobile] Dragging initiated but draggedElement is invalid. Cancelling drag.');
                finishDragging(true); // ドラッグをキャンセル
            }
        }, 150); // ドラッグ開始までの遅延
    } else {
        // ドラッグ可能な要素ではない場合のダブルクリック処理
        handleDoubleClick(event);
    }
}

/**
 * タッチ移動時の処理 (モバイル向け)。
 */
function handleTouchMove(event) {
    if (!isDragging || !currentTouchDraggedClone) {
        return; // ドラッグ中でなければ何もしない
    }

    event.preventDefault(); // デフォルトのスクロール動作などを防止

    const touch = event.touches[0];
    if (!touch) {
        console.warn("[handleTouchMove] No touch object found in event. Aborting move.");
        return;
    }

    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // クローン要素の位置を更新
    // クローンの中心がタッチ位置になるように調整
    const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
    currentTouchDraggedClone.style.left = `${currentX - cloneRect.width / 2}px`;
    currentTouchDraggedClone.style.top = `${currentY - cloneRect.height / 2}px`;

    // ドラッグオーバーのハイライトをリセット
    document.querySelectorAll('.setlist-slot').forEach(slot => {
        slot.classList.remove('drag-over');
    });

    // 現在のタッチ位置にある要素を取得
    const elementsAtPoint = document.elementsFromPoint(currentX, currentY);

    // ドロップ可能なセットリストスロットを探す
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot) {
        // ターゲットスロットが自身の元のスロットでない、かつ有効なドロップターゲットである場合
        const isSelfSlot = currentDraggingItem.originalSourceSlot !== -1 && 
                           targetSlot.dataset.slotIndex === currentDraggingItem.originalSourceSlot.toString();
        
        if (!isSelfSlot) { // 自分自身のスロットにはハイライトしない
            targetSlot.classList.add('drag-over');
        }
    }
}

/**
 * タッチ終了時の処理 (モバイル向け)。
 */
function handleTouchEnd(event) {
    console.log('[touchend] event fired. isDragging:', isDragging);

    clearTimeout(touchDragTimeout); // ドラッグ開始タイマーをクリア

    if (isDragging) {
        event.preventDefault(); // デフォルトの動作（スクロールなど）を防ぐ

        const touch = event.changedTouches[0];
        // クローンの位置からドロップターゲットを正確に判定
        const dropTargetElement = document.elementFromPoint(touch.clientX, touch.clientY);

        let dropSlotElement = dropTargetElement.closest('.setlist-slot');
        
        let dropTargetSlotIndex = -1; // デフォルトは無効な値
        if (dropSlotElement) {
            dropTargetSlotIndex = parseInt(dropSlotElement.dataset.slotIndex, 10);
        }

        console.log('[touchend] Drop target slot index:', dropTargetSlotIndex);

        // ドロップ処理を実行
        processDrop(currentDraggingItem.draggedElement, dropTargetSlotIndex, currentDraggingItem.originalSourceSlot);
        
    } else {
        // ドラッグではない場合の処理（例：短いタップはダブルクリックとして扱う）
        const now = new Date().getTime();
        const delta = now - lastTapTime;

        const touchedElement = event.target.closest('.setlist-item, .item');
        if (touchedElement && delta < 300 && delta > 0) { // 300ms以内のタップをダブルタップとみなす
            handleDoubleClick(event);
            console.log('[touchend] Double tap detected. Calling handleDoubleClick.');
            lastTapTime = 0; // リセット
        } else {
            lastTapTime = now;
            console.log('[touchend] Single tap or too slow. No drag, no double click.');
        }
    }
    finishDragging(false); // ドロップ処理後に必ずクリーンアップ
}

/**
 * ドラッグ&ドロップの終了処理をまとめた関数。
 * @param {boolean} [isCancelled=false] - ドラッグがキャンセルされたかどうか。
 */
function finishDragging(cancelled) {
    console.log('[finishDragging] Cleaning up dragging state. Cancelled:', cancelled);

    // ドラッグ中のクローン要素を削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    // PCドラッグの元の要素のクリーンアップ
    if (currentPcDraggedElement) {
        currentPcDraggedElement.classList.remove("dragging");
        currentPcDraggedElement = null;
    }

    // placeholder クラスと visibility:hidden を削除
    // PCとモバイル両方のプレースホルダーを考慮
    document.querySelectorAll('.setlist-slot.placeholder-slot, .setlist-slot.placeholder').forEach(slot => {
        slot.style.visibility = 'visible';
        slot.classList.remove('placeholder-slot', 'placeholder');
    });

    // すべてのスロットから drag-over クラスを削除し、pointer-eventsをリセット
    document.querySelectorAll('.setlist-slot').forEach(slot => {
        slot.classList.remove('drag-over');
        // アイテムが入っているスロットはpointer-events: auto; touch-action: pan-y;
        // 空のスロットはpointer-events: auto; touch-action: none; (ドロップターゲットのため)
        if (slot.classList.contains('setlist-item')) {
            slot.style.pointerEvents = 'auto';
            slot.style.touchAction = 'pan-y';
        } else {
            slot.style.pointerEvents = 'auto';
            slot.style.touchAction = 'none';
        }
    });

    // ドラッグ関連のグローバル変数をリセット
    isDragging = false;
    draggingItemId = null;
    originalSetlistSlot = null; // PC用もリセット
    
    currentDraggingItem.draggedElement = null;
    currentDraggingItem.originalSourceSlot = -1; // モバイル用もリセット

    // touchDragTimeout が設定されている場合はクリア
    if (touchDragTimeout) {
        clearTimeout(touchDragTimeout);
        touchDragTimeout = null;
    }
    // lastTapTimeもリセット
    lastTapTime = 0;


    // メニュー表示の更新など、必要に応じて他のクリーンアップ処理を追加
    hideSetlistItemsInMenu(); // セットリストの表示状態を更新

    console.log('[finishDragging] Dragging state cleaned up.');
}


/**
 * ドロップ処理を実行する関数。
 * @param {HTMLElement} draggedElement - ドロップされた元の要素（アルバムアイテムまたはセットリストアイテム）。
 * @param {number} dropTargetSlotIndex - ドロップされた先のセットリストスロットのインデックス (数値)。
 * @param {number} originalSourceSlotIndex - 元のセットリストスロットのインデックス（セットリスト内からのドラッグの場合）。アルバムからの場合は -1。
 */
function processDrop(draggedElement, dropTargetSlotIndex, originalSourceSlotIndex) {
    console.log('[processDrop] Initiated.');
    console.log('Dragged Element:', draggedElement);
    console.log('Drop Target Slot Index:', dropTargetSlotIndex);
    console.log('Original Source Slot Index:', originalSourceSlotIndex);

    if (!draggedElement) {
        console.error('[processDrop] draggedElement is null. Aborting drop.');
        return;
    }

    // ドロップターゲットが無効な場合
    if (dropTargetSlotIndex === -1 || isNaN(dropTargetSlotIndex)) {
        console.warn('[processDrop] Invalid drop target slot. Cancelling drop or returning to original position.');
        showMessage("無効なドロップ位置です。", "error");
        return;
    }

    const dropTargetSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${dropTargetSlotIndex}"]`);
    if (!dropTargetSlotElement) {
        console.error(`[processDrop] Drop target slot element not found for index: ${dropTargetSlotIndex}. Aborting.`);
        return;
    }

    const songData = getSlotItemData(draggedElement);
    if (!songData || !songData.itemId || !songData.name) {
        console.error('[processDrop] Failed to get valid song data from dragged element. Aborting.');
        return;
    }

    // セットリスト内での移動
    if (originalSourceSlotIndex !== -1) { // originalSourceSlotIndex が有効な数値の場合 (セットリスト内からのドラッグ)
        console.log('[processDrop] Moving item within setlist.');

        // 同じスロットにドロップした場合
        if (originalSourceSlotIndex === dropTargetSlotIndex) {
            console.log('[processDrop] Dropped back into the same slot. No change.');
            showMessage("同じ位置にドロップしました。", "info");
            return;
        }

        // 移動先のスロットの内容を取得
        let existingItemInTargetSlotData = null;
        const existingItemInTargetSlotElement = dropTargetSlotElement.querySelector('.setlist-item');
        if (existingItemInTargetSlotElement) {
            existingItemInTargetSlotData = getSlotItemData(existingItemInTargetSlotElement);
        }
        
        // 元のスロットのクリア
        clearSlotContent(originalSourceSlotIndex);

        // 新しい場所へアイテムを追加
        addSongToSlot(dropTargetSlotElement, songData.itemId, songData.name, {
            isShortVersion: songData.hasShortOption,
            hasSeOption: songData.hasSeOption,
            drumsoloOption: songData.hasDrumsoloOption,
            rGt: songData.rGt,
            lGt: songData.lGt,
            bass: songData.bass,
            bpm: songData.bpm,
            chorus: songData.chorus,
            short: songData.short, // 現在のチェック状態を渡す
            seChecked: songData.seChecked,
            drumsoloChecked: songData.drumsoloChecked
        }, songData.albumClass); // アルバムクラスを渡す

        // 元のスロットにターゲットにあったアイテムを移動 (スワップ)
        if (existingItemInTargetSlotData) {
            console.log(`[processDrop] Moving existing item ${existingItemInTargetSlotData.itemId} from slot ${dropTargetSlotIndex} to original slot ${originalSourceSlotIndex}.`);
            const originalSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${originalSourceSlotIndex}"]`);
            if (originalSlotElement) {
                addSongToSlot(originalSlotElement, existingItemInTargetSlotData.itemId, existingItemInTargetSlotData.name, {
                    isShortVersion: existingItemInTargetSlotData.hasShortOption,
                    hasSeOption: existingItemInTargetSlotData.hasSeOption,
                    drumsoloOption: existingItemInTargetSlotData.hasDrumsoloOption,
                    rGt: existingItemInTargetSlotData.rGt,
                    lGt: existingItemInTargetSlotData.lGt,
                    bass: existingItemInTargetSlotData.bass,
                    bpm: existingItemInTargetSlotData.bpm,
                    chorus: existingItemInTargetSlotData.chorus,
                    short: existingItemInTargetSlotData.short,
                    seChecked: existingItemInTargetSlotData.seChecked,
                    drumsoloChecked: existingItemInTargetSlotData.drumsoloChecked
                }, existingItemInTargetSlotData.albumClass);
            } else {
                console.error(`[processDrop] Original slot element not found for index ${originalSourceSlotIndex} during swap.`);
            }
        } else {
            console.log(`[processDrop] Target slot ${dropTargetSlotIndex} was empty. No swap needed.`);
        }
        showMessage("セットリスト内の曲を移動しました。", "success");

    } else {
        // アルバムメニューからセットリストへの追加
        console.log('[processDrop] Adding item from album menu to setlist.');
        addSongToSlot(dropTargetSlotElement, songData.itemId, songData.name, {
            isShortVersion: songData.hasShortOption,
            hasSeOption: songData.hasSeOption,
            drumsoloOption: songData.hasDrumsoloOption,
            rGt: songData.rGt,
Gt: songData.lGt,
            bass: songData.bass,
            bpm: songData.bpm,
            chorus: songData.chorus,
            // アルバムからの追加なので、チェックボックスは全てfalseで初期化
            short: false, 
            seChecked: false,
            drumsoloChecked: false
        }, songData.albumClass);
        showMessage("セットリストに曲を追加しました。", "success");
    }
}


/**
 * タッチドラッグ中に動かすクローン要素を作成する。
 * @param {HTMLElement} originalElement - ドラッグ開始された元の要素。
 * @param {number} initialX - タッチ開始時のX座標。
 * @param {number} initialY - タッチ開始時のY座標。
 */
function createTouchDraggedClone(originalElement, initialX, initialY) {
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body. Aborting clone creation.");
        return;
    }

    currentTouchDraggedClone = document.createElement('li');
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone", "setlist-item");

    // 元の要素からデータを取得
    const songData = getSlotItemData(originalElement);
    if (!songData) {
        console.error("[createTouchDraggedClone] Failed to get song data from original element. Cannot create clone.");
        return;
    }

    // dataset をクローンに設定
    for (const key in songData) {
        if (songData.hasOwnProperty(key)) {
            if (typeof songData[key] === 'boolean') {
                currentTouchDraggedClone.dataset[key] = songData[key] ? 'true' : 'false';
            } else {
                currentTouchDraggedClone.dataset[key] = songData[key];
            }
        }
    }
    // アルバムクラスもコピー
    if (songData.albumClass) {
        currentTouchDraggedClone.classList.add(songData.albumClass);
    }
    
    // クローンのコンテンツをシンプルに曲名のみで設定
    currentTouchDraggedClone.textContent = songData.name || 'Unnamed Song';

    document.body.appendChild(currentTouchDraggedClone);

    // クローンの位置とスタイル設定
    const rect = originalElement.getBoundingClientRect();
    Object.assign(currentTouchDraggedClone.style, {
        position: 'fixed',
        zIndex: '10000',
        width: rect.width + 'px',
        height: rect.height + 'px',
        left: (initialX - rect.width / 2) + 'px',
        top: (initialY - rect.height / 2) + 'px',
        pointerEvents: 'none', // クローンが下の要素のイベントをブロックしないようにする
        opacity: '0.9',
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #ccc',
        boxSizing: 'border-box'
    });
    console.log(`[createTouchDraggedClone] clone created for itemId=${songData.itemId} at (${currentTouchDraggedClone.style.left}, ${currentTouchDraggedClone.style.top})`);
}

/**
 * ダブルクリック（またはダブルタップ）時の処理。
 * セットリストの曲をアルバムに戻す、または短縮/SEオプションなどを切り替える。
 * アルバムの曲をセットリストに追加する。
 * @param {Event} event - ダブルクリックまたはタッチイベント。
 */
function handleDoubleClick(event) {
    event.preventDefault(); // ブラウザのデフォルトのダブルクリック動作を防止

    // イベントターゲットがチェックボックスの場合は何もしない
    if (event.target.closest('input[type="checkbox"]')) {
        console.log("[handleDoubleClick] Checkbox double-clicked. Skipping custom action.");
        return;
    }

    // 最初に、ダブルクリックされた要素がアルバム内の曲かチェック
    let albumItemElement = event.target.closest('.album-content .item');
    if (albumItemElement) {
        console.log("[handleDoubleClick] Double-clicked an album item. Attempting to add to setlist.");
        // セットリストの最初の空きスロットを探す
        const firstEmptySlot = document.querySelector('#setlist .setlist-slot:not(.setlist-item)');
        if (firstEmptySlot) {
            // albumItemElement からアイテムデータを取得 (getSlotItemDataを使用)
            const songData = getSlotItemData(albumItemElement);
            if (!songData) {
                console.warn("[handleDoubleClick] Could not get song data from album item. Aborting.");
                showMessage("曲のデータ取得に失敗しました。", "error");
                return;
            }

            // スロットにアイテムを追加
            addSongToSlot(firstEmptySlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                // アルバムからの追加なので、チェックボックスは全てfalseで初期化
                short: false,
                seChecked: false,
                drumsoloChecked: false
            }, songData.albumClass);
            showMessage("セットリストに曲を追加しました。", "success");
            hideSetlistItemsInMenu(); // メニュー内の重複を隠す
        } else {
            showMessage("セットリストに空きがありません。", "error");
        }
        return;
    }

    // 次に、セットリストの曲がダブルクリックされたかチェック
    let setlistItemElement = event.target.closest('.setlist-slot.setlist-item');
    if (setlistItemElement) {
        console.log(`[handleDoubleClick] Double-clicked setlist item: ID=${setlistItemElement.dataset.itemId}, Slot Index=${setlistItemElement.dataset.slotIndex}.`);
        // セットリストのアイテムがダブルクリックされたら、常に削除処理を行う
        restoreToOriginalList(setlistItemElement);
        return;
    }

    console.log("[handleDoubleClick] No valid setlist item or album item found for double click. Event target was:", event.target);
}


// =============================================================================
// PDF生成機能 (この関数は外部ライブラリ jspdf と jspdf-autotable に依存します)
// =============================================================================

/**
 * セットリストのPDFを生成し、共有またはダウンロードする。
 * 提供されたPDF形式（テーブル形式）に似たレイアウトで生成し、日本語に対応。
 * jsPDF-AutoTableを使用する。
 */
async function generateSetlistPdf() {
    showMessage("PDFを生成中...", "info");
    console.log("[generateSetlistPdf] PDF generation started.");

    const setlistYear = document.getElementById('setlistYear')?.value;
    const setlistMonth = document.getElementById('setlistMonth')?.value;
    const setlistDay = document.getElementById('setlistDay')?.value;
    const setlistVenue = document.getElementById('setlistVenue')?.value;

    let headerText = '';
    if (setlistYear && setlistMonth && setlistDay) {
        headerText += `${setlistYear}/${parseInt(setlistMonth)}/${parseInt(setlistDay)}`;
    }
    if (setlistVenue) {
        if (headerText) headerText += ' ';
        headerText += setlistVenue;
    }

    const tableHeaders = ["No.", "タイトル", "R.Gt(克哉)", "L.Gt(彰)", "Bass(信人)", "BPM", "コーラス"];
    const tableBody = [];
    const simplePdfBody = [];
    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

    let currentItemNoDetailed = 1;
    let currentItemNoSimple = 1;
    let currentItemNoShareable = 1;

    let shareableTextContent = '';
    if (headerText) {
        shareableTextContent += `${headerText}\n\n`;
    }

    for (const slot of setlistSlots) {
        if (slot.classList.contains('setlist-item')) {
            const songData = getSlotItemData(slot);
            if (!songData) continue;

            let titleText = songData.name || '';
            if (songData.short) titleText += ' (Short)';
            if (songData.seChecked) titleText += ' (SE有り)';
            if (songData.drumsoloChecked) titleText += ' (ドラムソロ有り)';

            const isAlbum1 = songData.itemId && album1ItemIds.includes(songData.itemId);

            const detailedRowNo = isAlbum1 ? '' : (currentItemNoDetailed++).toString();
            tableBody.push([
                detailedRowNo, titleText, songData.rGt || '', songData.lGt || '',
                songData.bass || '', songData.bpm || '', (songData.chorus === 'true' ? '有' : '')
            ]);

            if (isAlbum1) {
                simplePdfBody.push(`    ${titleText}`);
            } else {
                simplePdfBody.push(`${currentItemNoSimple++}. ${titleText}`);
            }

            if (isAlbum1) {
                shareableTextContent += `    ${titleText}\n`;
            } else {
                shareableTextContent += `${currentItemNoShareable++}. ${titleText}\n`;
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                tableBody.push([textContent, '', '', '', '', '', '']);
                simplePdfBody.push(textContent);
                shareableTextContent += `${textContent}\n`;
            }
        }
    }

    console.log("[generateSetlistPdf] Generated Shareable Text:\n", shareableTextContent);

    try {
        const { jsPDF } = window.jspdf;
        function registerJapaneseFont(doc) {
            console.warn("Japanese font for jsPDF is not embedded. PDF might not display Japanese characters correctly without it.");
            doc.setFont('helvetica'); // fallback
        }

        // --- 1. 詳細なセットリストPDFの生成 ---
        const detailedPdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(detailedPdf);

        const headerCellHeight = 10;
        const topMargin = 20;
        const leftMargin = 10;
        const pageWidth = detailedPdf.internal.pageSize.getWidth();
        const tableWidth = pageWidth - (leftMargin * 2);
        let detailedYPos = topMargin;

        if (headerText) {
            detailedPdf.setFillColor(220, 220, 220);
            detailedPdf.setDrawColor(0, 0, 0);
            detailedPdf.setLineWidth(0.3);
            detailedPdf.rect(leftMargin, detailedYPos, tableWidth, headerCellHeight, 'FD');
            detailedPdf.setFontSize(14);
            detailedPdf.setFont('NotoSansJP', 'bold');
            detailedPdf.setTextColor(0, 0, 0);
            detailedPdf.text(headerText, pageWidth / 2, detailedYPos + headerCellHeight / 2 + 0.5, { align: 'center', baseline: 'middle' });
            detailedYPos += headerCellHeight;
        }

        detailedPdf.autoTable({
            head: [tableHeaders],
            body: tableBody,
            startY: detailedYPos,
            theme: 'grid',
            styles: {
                font: 'NotoSansJP', fontSize: 10, cellPadding: 2,
                lineColor: [0, 0, 0], lineWidth: 0.3, textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [220, 220, 220], textColor: [0, 0, 0],
                font: 'NotoSansJP', fontStyle: 'bold', halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 72, halign: 'left' },
                2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 18, halign: 'center' },
                6: { cellWidth: 22, halign: 'center' }
            },
            margin: { top: topMargin, right: 10, bottom: 10, left: leftMargin },
            didDrawPage: function (data) {
                detailedPdf.setFontSize(10);
                detailedPdf.setFont('NotoSansJP', 'normal');
                detailedPdf.text('Page ' + detailedPdf.internal.getNumberOfPages(), detailedPdf.internal.pageSize.getWidth() - 10, detailedPdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        });

        const detailedFilename = `セットリスト_詳細_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        detailedPdf.save(detailedFilename);
        console.log("[generateSetlistPdf] Detailed PDF generated and downloaded:", detailedFilename);

        await new Promise(resolve => setTimeout(resolve, 500));

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf);

        simplePdf.setFont('NotoSansJP', 'bold');
        const simpleFontSize = 28;
        simplePdf.setFontSize(simpleFontSize);

        const simpleTopMargin = 30;
        let simpleYPos = simpleTopMargin;
        const simpleLeftMargin = 25;

        if (headerText) {
            simplePdf.setFontSize(simpleFontSize + 8);
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 1.5;
            simplePdf.setFontSize(simpleFontSize);
        }

        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 1.25;

            const bottomMarginThreshold = simpleFontSize + 10;
            if (simpleYPos > simplePdf.internal.pageSize.getHeight() - bottomMarginThreshold) {
                simplePdf.addPage();
                simpleYPos = simpleTopMargin;
                simplePdf.setFont('NotoSansJP', 'bold');
                simplePdf.setFontSize(simpleFontSize);
            }
        });

        const simpleFilename = `セットリスト_シンプル_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        simplePdf.save(simpleFilename);
        console.log("[generateSetlistPdf] Simple PDF generated and downloaded:", simpleFilename);

        showMessage("2種類のPDFを生成しました！", "success");

    } catch (error) {
        console.error("[generateSetlistPdf] PDF生成に失敗しました:", error);
        showMessage("PDF生成に失敗しました。", "error");
    }
}


// =============================================================================
// Firebase連携と状態管理 (この機能はFirebase SDKに依存します)
// =============================================================================

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
    // Firebaseが初期化されているか、databaseオブジェクトが利用可能かを確認
    if (typeof firebase === 'undefined' || !firebase.database) {
        showMessage('Firebaseが初期化されていません。', 'error');
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    const currentState = getCurrentState(); // セットリストの現在の状態を取得する関数（外部で定義されている想定）
    const setlistRef = database.ref('setlists').push(); // Firebase Realtime Database の参照を取得

    setlistRef.set(currentState)
        .then(() => {
            const shareId = setlistRef.key;
            const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

            let shareText = '';
            if (currentState.setlistDate || currentState.setlistVenue) {
                shareText += '------------------------------\n';
                if (currentState.setlistDate) shareText += `日付: ${currentState.setlistDate}\n`;
                if (currentState.setlistVenue) shareText += `会場: ${currentState.setlistVenue}\n`;
                shareText += '------------------------------\n\n';
            }

            let songListText = "";
            let shareableTextItemNo = 1;

            currentState.setlist.forEach(songData => {
                if (!songData) return;

                let titleText = songData.name || '';
                if (songData.short) titleText += ' (Short)';
                if (songData.seChecked) titleText += ' (SE有り)';
                if (songData.drumsoloChecked) titleText += ' (ドラムソロ有り)';

                const isAlbum1 = songData.itemId && album1ItemIds.includes(songData.itemId);

                if (isAlbum1) {
                    songListText += `    ${titleText}\n`;
                } else {
                    songListText += `${shareableTextItemNo++}. ${titleText}\n`;
                }
            });
            shareText += songListText;

            if (navigator.share) {
                navigator.share({
                    title: 'セットリスト共有',
                    text: shareText,
                    url: shareLink,
                })
                    .then(() => console.log('[shareSetlist] Web Share API Success'))
                    .catch((error) => {
                        console.error('[shareSetlist] Web Share API Failed:', error);
                        if (error.name !== 'AbortError') showMessage('共有に失敗しました。', 'error');
                    });
            } else {
                const tempInput = document.createElement('textarea');
                tempInput.value = `${shareText}\n共有リンク: ${shareLink}`;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showMessage('セットリスト情報と共有リンクをクリップボードにコピーしました！', 'success');
                console.log(`[shareSetlist] Setlist saved. Share ID: ${shareId}, Link: ${shareLink} (using execCommand)`);
            }
        })
        .catch(error => {
            console.error('[shareSetlist] Firebaseへの保存に失敗しました:', error);
            showMessage('セットリストの保存に失敗しました。', 'error');
        });
}

/**
 * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
 * @returns {Promise<void>} ロード処理の完了を示すPromise
 */
function loadSetlistState() {
    return new Promise((resolve, reject) => {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('shareId');

        if (!shareId) {
            console.log("[loadSetlistState] No shareId found in URL. Initializing default date.");
            updateDatePickersToToday();
            return resolve();
        }

        if (typeof firebase === 'undefined' || !firebase.database) {
            showMessage('Firebaseが初期化されていません。', 'error');
            console.error('Firebase is not initialized or firebase.database is not available.');
            return reject(new Error('Firebase not initialized.'));
        }

        console.log(`[loadSetlistState] Loading state for shareId: ${shareId}`);
        const setlistRef = database.ref(`setlists/${shareId}`);
        setlistRef.once('value')
            .then((snapshot) => {
                const state = snapshot.val();
                if (state && state.setlist) {
                    console.log("[loadSetlistState] State loaded:", state);

                    // セットリスト、アルバム表示、マップを初期化
                    document.querySelectorAll('#setlist .setlist-slot').forEach(slot => {
                        const slotIndex = parseInt(slot.dataset.slotIndex, 10);
                        clearSlotContent(slotIndex); // スロットをクリアする
                    });
                    document.querySelectorAll('.album-content .item').forEach(item => item.style.visibility = '');
                    originalAlbumMap.clear();
                    console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

                    if (state.originalAlbumMap) {
                        for (const key in state.originalAlbumMap) {
                            originalAlbumMap.set(key, state.originalAlbumMap[key]);
                        }
                        console.log("[loadSetlistState] originalAlbumMap restored:", originalAlbumMap);
                    }

                    // 日付と会場の復元
                    const setlistYear = document.getElementById('setlistYear');
                    const setlistMonth = document.getElementById('setlistMonth');
                    const setlistDay = document.getElementById('setlistDay');
                    const setlistVenue = document.getElementById('setlistVenue');

                    if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                        const dateParts = state.setlistDate.split('-');
                        if (dateParts.length === 3) {
                            setlistYear.value = dateParts[0];
                            setlistMonth.value = dateParts[1];
                            updateDays();
                            setlistDay.value = dateParts[2];
                            console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                        } else {
                            console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                        }
                    } else {
                        console.log("[loadSetlistState] No date to restore or date select elements not found.");
                        updateDatePickersToToday();
                    }
                    if (setlistVenue) {
                        setlistVenue.value = state.setlistVenue || '';
                        console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
                    }

                    // セットリストアイテムの復元
                    state.setlist.forEach(itemData => {
                        const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
                        if (targetSlot && itemData.itemId) { // itemIdがある場合のみ復元
                            fillSlotWithItem(targetSlot, itemData);
                            console.log(`[loadSetlistState] Filled slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                        } else if (targetSlot && itemData.textContent) { // テキストスロットの場合
                            targetSlot.classList.add('setlist-slot-text');
                            targetSlot.innerHTML = `<span class="slot-number">${itemData.slotIndex + 1}.</span><span class="song-info">${itemData.textContent}</span>`;
                            targetSlot.style.pointerEvents = 'auto'; // テキストスロットもドロップ可能にする
                            targetSlot.style.touchAction = 'none'; // スクロールさせない
                            console.log(`[loadSetlistState] Filled slot ${itemData.slotIndex} with text: ${itemData.textContent}`);
                        } else {
                            console.warn(`[loadSetlistState] Target slot not found or itemData invalid for index: ${itemData.slotIndex}`);
                        }
                    });

                    // メニューとアルバムの開閉状態を復元
                    menu.classList.toggle('open', state.menuOpen);
                    menuButton.classList.toggle('open', state.menuOpen);
                    document.querySelectorAll('.album-content').forEach(album => album.classList.remove('active'));
                    if (state.openAlbums && Array.isArray(state.openAlbums)) {
                        state.openAlbums.forEach(albumId => {
                            const albumElement = document.getElementById(albumId);
                            if (albumElement) albumElement.classList.add('active');
                        });
                    }
                    resolve();
                } else {
                    showMessage('共有されたセットリストが見つかりませんでした。', 'error');
                    console.warn("[loadSetlistState] Shared setlist state not found or invalid.");
                    updateDatePickersToToday();
                    resolve();
                }
            })
            .catch((error) => {
                console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
                showMessage('セットリストのロードに失敗しました。', 'error');
                updateDatePickersToToday();
                reject(error);
            });
    });
}

/**
 * 現在のセットリストとUIの状態を取得し、Firebaseに保存可能な形式で返す。
 * (この関数は外部で定義されていると想定)
 * @returns {object} 現在のアプリケーションの状態
 */
function getCurrentState() {
    const setlistItems = [];
    document.querySelectorAll('#setlist .setlist-slot').forEach(slot => {
        const slotIndex = parseInt(slot.dataset.slotIndex, 10);
        if (slot.classList.contains('setlist-item')) {
            const songData = getSlotItemData(slot);
            if (songData) {
                // slotIndex を songData に追加して保存
                setlistItems.push({ ...songData, slotIndex: slotIndex });
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            setlistItems.push({
                slotIndex: slotIndex,
                textContent: slot.querySelector('.song-info')?.textContent.trim() || ''
            });
        } else {
            // 空のスロットはnullまたは空オブジェクトで保存する
            setlistItems.push(null);
        }
    });

    const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

    return {
        setlist: setlistItems,
        setlistDate: `${document.getElementById('setlistYear')?.value || ''}-${document.getElementById('setlistMonth')?.value || ''}-${document.getElementById('setlistDay')?.value || ''}`,
        setlistVenue: document.getElementById('setlistVenue')?.value || '',
        menuOpen: menu.classList.contains('open'),
        openAlbums: openAlbums,
        // originalAlbumMap は Firebase に Map として直接保存できないため、オブジェクトに変換
        originalAlbumMap: Object.fromEntries(originalAlbumMap)
    };
}

/**
 * アルバムメニュー内の曲の表示/非表示を更新する。
 */
function hideSetlistItemsInMenu() {
    // すべてのアルバムアイテムを表示状態に戻す
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.display = ''; // または 'block', 'flex' など、元の display プロパティに応じて
    });

    // セットリストにあるアイテムを非表示にする
    document.querySelectorAll('#setlist .setlist-item').forEach(setlistItem => {
        const itemId = setlistItem.dataset.itemId;
        if (itemId) {
            const correspondingAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (correspondingAlbumItem) {
                correspondingAlbumItem.style.display = 'none';
            }
        }
    });
    console.log("[hideSetlistItemsInMenu] Album menu visibility updated.");
}

/**
 * メッセージボックスを表示する関数。
 * @param {string} message - 表示するメッセージ。
 * @param {string} type - メッセージの種類 ('success', 'error', 'info', 'warning')。
 */
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    if (!messageBox) {
        console.warn("MessageBox element not found.");
        return;
    }

    messageBox.textContent = message;
    messageBox.className = 'message-box'; // すべての既存クラスをクリア
    messageBox.classList.add(type);
    messageBox.classList.add('show');

    // メッセージが自動的に消えるようにする
    setTimeout(() => {
        messageBox.classList.remove('show');
        // アニメーション終了後にコンテンツをクリア
        messageBox.addEventListener('transitionend', () => {
            if (!messageBox.classList.contains('show')) {
                messageBox.textContent = '';
            }
        }, { once: true });
    }, 3000); // 3秒後に消える
}

// =============================================================================
// UI操作関数
// =============================================================================

/**
 * メニューの開閉を切り替える。
 */
function toggleMenu() {
    menu.classList.toggle("open");
    menuButton.classList.toggle("open");
    console.log(`[toggleMenu] Menu is now: ${menu.classList.contains('open') ? 'open' : 'closed'}`);
}

/**
 * アルバムの表示を切り替える。
 * @param {number} albumIndex - 切り替えるアルバムのインデックス
 */
function toggleAlbum(albumIndex) {
    document.querySelectorAll(".album-content").forEach(content => {
        if (content.id === "album" + albumIndex) {
            content.classList.toggle("active");
            console.log(`[toggleAlbum] Album ${albumIndex} is now: ${content.classList.contains('active') ? 'active' : 'inactive'}`);
        } else {
            content.classList.remove("active");
        }
    });
}

/**
 * 日のドロップダウンを更新する関数
 */
function updateDays() {
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    if (!setlistYear || !setlistMonth || !setlistDay) {
        console.warn("[updateDays] Date select elements not found. Cannot update days.");
        return;
    }
    const currentDay = setlistDay.value; // 現在選択されている日を保持
    setlistDay.innerHTML = '';
    const year = parseInt(setlistYear.value);
    const month = parseInt(setlistMonth.value);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i;
        setlistDay.appendChild(option);
    }
    // 現在選択されていた日があればそれを再選択、なければ最大日数を超えないように調整
    if (currentDay && parseInt(currentDay) <= daysInMonth) {
        setlistDay.value = currentDay;
    } else if (parseInt(currentDay) > daysInMonth) {
        setlistDay.value = daysInMonth.toString().padStart(2, '0');
    }
    console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}`);
}

/**
 * 日付ピッカーを今日の日付に設定する
 */
function updateDatePickersToToday() {
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    if (setlistYear && setlistMonth && setlistDay) {
        const today = new Date();
        setlistYear.value = today.getFullYear();
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        updateDays();
        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[updateDatePickersToToday] Set setlist date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[updateDatePickersToToday] Date select elements not fully found. Skipping auto-set date.");
    }
}


// =============================================================================
// イベントリスナーの登録と初期化
// =============================================================================

/**
 * ドラッグ＆ドロップとダブルクリックを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // 既存のリスナーを削除してから追加することで、二重登録を防ぐ
    element.removeEventListener("dragstart", handleDragStart);
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchmove", handleTouchMove);
    element.removeEventListener("touchend", handleTouchEnd);
    element.removeEventListener("touchcancel", handleTouchEnd);
    element.removeEventListener("dblclick", handleDoubleClick);
    element.removeEventListener("dragover", handleDragOver);
    element.removeEventListener("drop", handleDrop);
    element.removeEventListener("dragenter", handleDragEnter);
    element.removeEventListener("dragleave", handleDragLeave);

    if (element.classList.contains('item') || element.classList.contains('setlist-item')) { // album item と setlist item 両方
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) {
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true;

        element.addEventListener("dragstart", handleDragStart);
        // passive: false を設定し、event.preventDefault() が機能するようにする
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
        element.addEventListener("dblclick", handleDoubleClick);
    }

    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
    }
}


function initializeSetlistSlots() {
    const setlistContainer = document.querySelector('.setlist-container');
    if (!setlistContainer) return;

    // 現在のスロット数を取得
    const existingSlots = setlistContainer.querySelectorAll('.setlist-slot').length;

    // 必要に応じてスロットを追加（例: 10個のスロットを保証）
    const targetSlotCount = 10;
    for (let i = existingSlots; i < targetSlotCount; i++) {
        const slot = document.createElement('li');
        slot.classList.add('setlist-slot');
        slot.setAttribute('data-slot-index', i);
        slot.innerHTML = `<span class="slot-number">${i + 1}.</span><span class="song-info"></span>`;
        setlistContainer.appendChild(slot);
    }

    // 既存のスロットにも data-slot-index が確実に設定されているか確認するループを追加
    setlistContainer.querySelectorAll('.setlist-slot').forEach((slot, index) => {
        slot.setAttribute('data-slot-index', index);
        // DOMContentLoaded で enableDragAndDrop を呼び出すので、ここでは冗長
    });

    console.log('[initializeSetlistSlots] Setlist slots initialized with data-slot-index.');
}


// ページロード時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application.");

    // まずスロットを初期化して、data-slot-index を確保
    initializeSetlistSlots();

    // --- ドラッグ＆ドロップ関連の初期設定 ---
    document.querySelectorAll(".album-content .item").forEach(item => {
        enableDragAndDrop(item);
    });

    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        enableDragAndDrop(slot); // スロット自体にイベントを設定

        // スロット内のチェックボックスに対するイベントリスナー（バブリング対策）
        slot.addEventListener('click', (e) => {
            const checkbox = e.target.closest('input[type="checkbox"]');
            if (checkbox && slot.classList.contains('setlist-item')) {
                e.stopPropagation(); // 親要素へのイベント伝播を停止
                console.log(`[slotClick] Checkbox for ${checkbox.dataset.optionType} in slot ${slot.dataset.slotIndex} was clicked. State: ${checkbox.checked}`);
                lastTapTime = 0; // ダブルタップ判定をリセット
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
        });
    });
    
    // Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
    document.addEventListener("dragend", finishDragging);


    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');

    if (setlistYear) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear + 5; i >= currentYear - 30; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            setlistYear.appendChild(option);
        }
    }
    if (setlistMonth) {
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i;
            setlistMonth.appendChild(option);
        }
    }

    if (setlistYear) setlistYear.addEventListener('change', updateDays);
    if (setlistMonth) setlistMonth.addEventListener('change', updateDays);


    // --- モーダル関連の初期設定 ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton');

    const open2025FromPastModalButton = document.getElementById('open2025FromPastModalButton');
    const year2025DetailModal = document.getElementById('year2025DetailModal');
    const close2025DetailModalButton = document.getElementById('close2025DetailModalButton');

    // 「過去セットリスト」モーダルの開閉
    if (openPastSetlistsModalButton && pastSetlistsModal && closePastSetlistsModalButton) {
        openPastSetlistsModalButton.addEventListener('click', () => pastSetlistsModal.classList.add('active'));
        closePastSetlistsModalButton.addEventListener('click', () => pastSetlistsModal.classList.remove('active'));
        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) pastSetlistsModal.classList.remove('active');
        });
    }

    // 2025年セットリスト詳細モーダルの開閉
    if (year2025DetailModal && close2025DetailModalButton) {
        if (open2025FromPastModalButton) {
            open2025FromPastModalButton.addEventListener('click', () => {
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                year2025DetailModal.classList.add('active');
            });
        }
        close2025DetailModalButton.addEventListener('click', () => year2025DetailModal.classList.remove('active'));
        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) year2025DetailModal.classList.remove('active');
        });
    }

    // モーダル内の setlist-link のクリックハンドラ (共有IDのロードとモーダルクローズ)
    document.querySelectorAll('.setlist-link').forEach(link => {
        link.addEventListener('click', (event) => {
            const shareIdMatch = link.href.match(/\?shareId=([^&]+)/);
            if (shareIdMatch) {
                event.preventDefault();
                const shareId = shareIdMatch[1];
                const newUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
                window.history.pushState({ path: newUrl }, '', newUrl);

                loadSetlistState().then(() => {
                    console.log(`[setlist-link click] Setlist loaded from shareId: ${shareId}`);
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (year2025DetailModal) year2025DetailModal.classList.remove('active');
                }).catch(error => console.error("[setlist-link click] Error loading setlist:", error));
            } else {
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                if (year2025DetailModal) year2025DetailModal.classList.remove('active');
            }
        });
    });

    // --- 最終クリーンアップと初期ロード ---
    loadSetlistState().then(() => {
        console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
        hideSetlistItemsInMenu();
        // 初期ロード後、すべてのセットリストスロットのpointer-eventsを適切に設定
        document.querySelectorAll('.setlist-slot').forEach(slot => {
            if (slot.classList.contains('setlist-item')) {
                slot.style.pointerEvents = 'auto';
                slot.style.touchAction = 'pan-y';
            } else {
                slot.style.pointerEvents = 'auto'; // 空のスロットもドロップターゲットになる
                slot.style.touchAction = 'none';
            }
        });
    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        hideSetlistItemsInMenu();
    });
});