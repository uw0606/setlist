// =============================================================================
// グローバル変数とDOM要素の参照 (最終修正版)
// =============================================================================

// --- ドラッグ＆ドロップ (D&D) 状態管理 ---
let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムID (PC/Mobile共通)
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)

// --- タッチ操作関連 ---
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let touchTimeout = null; // setTimeout のIDを保持する変数 (ロングプレス判定用)
let currentTouchDraggedOriginalElement = null; // モバイルのタッチドラッグで元の要素を保持

// --- セットリスト内のD&D参照 ---
let originalSetlistSlot = null; // PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す
let currentDropZone = null;
let activeTouchSlot = null; // モバイルでのドロップゾーンハイライト用

// --- データ/UI参照 ---
let setlist = null; // セットリストコンテナ（#setlist）。DOMContentLoaded で設定
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap（削除・復元用）
const maxSongs = 26; // セットリストの最大曲数

// --- DOM要素参照（初期化） ---
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");

// --- 自動スクロール (autoScrollSetlist) 関連 ---
let rafId = null; // requestAnimationFrame のID
let lastScrollDirection = 0; // 最後に要求されたスクロール方向を保持

// --- 自動スクロールの定数 ---
// const SCROLL_SPEED = 20; // 1フレームあたりのスクロール速度 (px)
// const SCROLL_AREA_HEIGHT = 100; // スクロールを開始する画面端の領域 (px)


/**
 * モバイルタッチドラッグ中に自動スクロールを開始する、画面端からの領域の高さ (px)。
 * このピクセル数内に指が入るとスクロールが始まります。
 */
const SCROLL_AREA_HEIGHT = 80; 

/**
 * 自動スクロールの速度 (px/フレーム)。
 */
const SCROLL_SPEED = 5;



// アルバム1として扱うdata-item-idのリスト（共有テキスト、PDF生成時に使用）
const album1ItemIds = [
    'album1-001', 'album1-002', 'album1-004', 'album1-005', 
    'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010', 
    'album1-011', 'album1-012', 'album1-013', 'album1-014', 'album1-015', 
    'album9-001', 'album10-001', 
    'album11-015', 'album12-013', 'album13-012', 'album14-001', 'album15-040', 'album1-se-custom',
];

// ★特効オプションの定義を追記★
const specialEffectOptions = [
    { value: '', label: 'ーーーーー' }, // 初期状態
    { value: 'fire', label: 'FF' },
    { value: 'smoke', label: '銀煙弾' },
    { value: 'bazooka', label: 'キャノン砲' },
    { value: 'confetti', label: '紙吹雪' },
];

// ★追加：特効プルダウンを表示しない曲のリスト★
const specialEffectExclusionList = [
    'album1-001', 'album1-002', 'album1-003', 'album1-004', 'album1-005', 
    'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010', 
    'album1-011', 'album1-012', 'album1-013', 'album1-014', 'album1-015', 
    'album9-001', 'album10-001', 
    'album11-015', 'album12-013', 'album13-012', 'album14-001', 'album15-040', 'album1-se-custom',
];


// 🎸 R.Gt のチューニングオプション
const customRGtTuningOptions = [
    { value: '', label: 'R.Gt' }, // 元の表示はプルダウンの初期表示に設定（データ値は空）
    { value: 'REG', label: 'REG' },
    { value: '半音下げ', label: '半音下げ' },
    { value: 'Drop D', label: 'Drop D' },
    { value: 'Drop C#', label: 'Drop C#' },
    { value: 'Drop C', label: 'Drop C' },
    { value: 'Drop B', label: 'Drop B' }
];

// 🎸 L.Gt のチューニングオプション
const customLGtTuningOptions = [
    { value: '', label: 'L.Gt' }, // ラベルを L.Gt に修正
    { value: 'REG', label: 'REG' },
    { value: '半音下げ', label: '半音下げ' },
    { value: 'Drop D', label: 'Drop D' },
    { value: 'Drop C#', label: 'Drop C#' },
    { value: 'Drop C', label: 'Drop C' },
    { value: 'Drop B', label: 'Drop B' }
];

// customBassTuningOptions, customChorusOptions, customBpmOptions は変更なし

// 🎸 Bass のチューニングオプション
const customBassTuningOptions = [
    { value: '', label: 'Bass' }, // 元の表示はプルダウンの初期表示に設定（データ値は空）
    { value: '5 Low C', label: '5 Low C' },
    { value: '5 REG', label: '5 REG' },
    { value: '5 半↓', label: '5 半↓' },
    { value: 'REG', label: 'REG' },
    { value: 'Drop D', label: 'Drop D' },
    { value: '半↓', label: '半↓' },
    { value: 'Drop C#', label: 'Drop C#' }
];

// 🎤 コーラスオプション
const customChorusOptions = [
    { value: 'false', label: 'コーラス' }, // 修正: 初期表示を「コーラス」に変更
    { value: '克・信', label: '克・信' }, 
    { value: '克', label: '克' },
    { value: '信', label: '信' }
];

/**
 * 50から250までのBPMオプションを生成するヘルパー関数
 * @returns {Array<Object>} BPMオプションの配列
 */
function generateBpmOptions() {
    // 修正: 初期表示のラベルを「BPM」に変更
    const options = [{ value: '', label: 'BPM' }]; 
    for (let i = 50; i <= 250; i++) {
        options.push({ value: i.toString(), label: i.toString() });
    }
    return options;
}

const customBpmOptions = generateBpmOptions();

// Firebaseの初期化（これはHTMLまたは別のJSファイルで一度だけ行う必要があります）
// 例:
// if (typeof firebase !== 'undefined' && firebaseConfig) {
//     firebase.initializeApp(firebaseConfig);
//     var database = firebase.database();
// }

/**
 * 特効のvalueから表示用のラベルを取得する。
 * @param {string} effectValue - 特効のデータ値 (例: 'fire', 'smoke')
 * @returns {string} 表示用のラベル (例: '炎', '煙') または空白
 */
function getSpecialEffectLabel(effectValue) {
    // specialEffectOptions が定義されていることを前提とする
    if (!effectValue || effectValue === '' || typeof specialEffectOptions === 'undefined') {
        return '';
    }
    const option = specialEffectOptions.find(opt => opt.value === effectValue);
    // 「特効なし」や未定義のオプションを除外し、ラベルを返す
    return (option && option.value !== '') ? option.label : ''; 
}


// =============================================================================
// ヘルパー関数
// =============================================================================

function getSlotItemData(element) {
    if (!element) {
        console.warn("[getSlotItemData] Provided element is null. Returning null.");
        return null;
    }

    const isSetlistItem = element.classList.contains('setlist-item');
    const isAlbumItem = element.classList.contains('item') && !isSetlistItem;

    let songName = '';
    let isCheckedShort = false; 
    let isCheckedSe = false;    
    let isCheckedDrumsolo = false; 
    
    let hasShortOption = (element.dataset.isShortVersion === 'true');
    let hasSeOption = (element.dataset.hasSeOption === 'true');
    let hasDrumsoloOption = (element.dataset.hasDrumsoloOption === 'true');
    
    const albumClass = Array.from(element.classList).find(className => className.startsWith('album'));
    let itemId = element.dataset.itemId;

    let rGt = element.dataset.rGt || '';
    let lGt = element.dataset.lGt || '';
    let bass = element.dataset.bass || '';
    let bpm = element.dataset.bpm || '';
    let chorus = element.dataset.chorus || '';
    // ★追加：特効の選択状態を取得★
    let specialEffect = element.dataset.specialEffect || '';

    if (isSetlistItem) {
        songName = element.dataset.songName || '';
        isCheckedShort = (element.dataset.short === 'true'); 
        isCheckedSe = (element.dataset.seChecked === 'true'); 
        isCheckedDrumsolo = (element.dataset.drumsoloChecked === 'true'); 
        
        hasShortOption = (element.dataset.isShortVersion === 'true');
        hasSeOption = (element.dataset.hasSeOption === 'true');
        hasDrumsoloOption = (element.dataset.drumsoloOption === 'true');

        // 自由入力曲の場合、input要素から曲名を取得
        const customInput = element.querySelector('.custom-song-input');
        if (customInput) {
            songName = customInput.value.trim() || '自由入力曲';
        } else {
            songName = element.dataset.songName || '';
        }

    } else if (isAlbumItem) {
        songName = element.dataset.songName || element.textContent.trim();
        hasShortOption = (element.dataset.isShortVersion === 'true');
        hasSeOption = (element.dataset.hasSeOption === 'true');
        hasDrumsoloOption = (element.dataset.hasDrumsoloOption === 'true');
        isCheckedShort = false;
        isCheckedSe = false;
        isCheckedDrumsolo = false;

    } else if (element.dataset.itemId) { // クローン要素などの場合
        songName = element.dataset.songName || '';
        isCheckedShort = (element.dataset.short === 'true');
        isCheckedSe = (element.dataset.seChecked === 'true');
        isCheckedDrumsolo = (element.dataset.drumsoloChecked === 'true');
        hasShortOption = (element.dataset.isShortVersion === 'true');
        hasSeOption = (element.dataset.hasSeOption === 'true');
        hasDrumsoloOption = (element.dataset.drumsoloOption === 'true');
    } else {
        console.warn("[getSlotItemData] Element has no recognizable data for item:", element);
        return null;
    }

    return {
        name: songName,
        short: isCheckedShort,
        seChecked: isCheckedSe,
        drumsoloChecked: isCheckedDrumsolo,
        hasShortOption: hasShortOption,
        hasSeOption: hasSeOption,
        hasDrumsoloOption: hasDrumsoloOption,
        albumClass: albumClass,
        itemId: itemId,
        slotIndex: element.dataset.slotIndex,
        rGt: rGt,
        lGt: lGt,
        bass: bass,
        bpm: bpm,
        chorus: chorus,
        // ★追加：特効の状態をリターン★
        specialEffect: specialEffect 
    };
}



/**
 * 指定されたセットリストスロットの内容をクリアする関数。
 * @param {HTMLElement} slotElement - クリアするセットリストスロット要素。
 */
function clearSlotContent(slotElement) {
    // スロット内の子要素をすべて削除
    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }

    // データ属性を削除
    delete slotElement.dataset.itemId;
    delete slotElement.dataset.songName;
    delete slotElement.dataset.isShortVersion;
    delete slotElement.dataset.hasSeOption;
    delete slotElement.dataset.drumsoloOption;
    delete slotElement.dataset.rGt;
    delete slotElement.dataset.lGt;
    delete slotElement.dataset.bass;
    delete slotElement.dataset.bpm;
    delete slotElement.dataset.chorus;
    delete slotElement.dataset.short;
    delete slotElement.dataset.seChecked;
    delete slotElement.dataset.drumsoloChecked;

    // 関連するクラスを削除
    slotElement.classList.remove(
        'setlist-item', 'item', 'short', 'se-active', 'drumsolo-active'
    );
    // album* クラスも動的に削除する必要がある
    Array.from(slotElement.classList).forEach(cls => {
        if (cls.startsWith('album')) {
            slotElement.classList.remove(cls);
        }
    });

    // スタイルをリセット (必要であれば)
    slotElement.style.pointerEvents = 'none'; // 空スロットはドロップターゲットとしてのみ機能させる
    slotElement.style.touchAction = 'none';
    slotElement.style.visibility = 'visible'; // 念のため表示状態に戻す
    slotElement.classList.remove('placeholder-slot'); // プレースホルダークラスも削除
    
    console.log(`[clearSlotContent] Slot ${slotElement.dataset.slotIndex || 'null'} cleared successfully.`);
}



/**
 * セットリストから曲を削除し、アルバムリストに「戻す」処理 (実際にはセットリストから削除するだけ)。
 * @param {HTMLElement} setlistItem - セットリストから削除するHTML要素。
 */
function restoreToOriginalList(setlistItem) {
    if (!setlistItem || !setlistItem.classList.contains('setlist-item')) {
        console.warn("[restoreToOriginalList] Invalid element passed or element is not a setlist item. Cannot restore.");
        return; // 無効な要素であれば処理を中断
    }

    const slotIndex = setlistItem.dataset.slotIndex;
    const itemId = setlistItem.dataset.itemId;

    console.log(`[restoreToOriginalList] Restoring item ${itemId} from slot ${slotIndex} to original list.`);

    // スロットの内容をクリア
    clearSlotContent(setlistItem);

    // アルバムメニュー内の表示を更新 (hideSetlistItemsInMenuが呼ばれることで、このアイテムが再表示される)
    hideSetlistItemsInMenu(); 

    showMessage("セットリストから曲を削除しました。", "success");
}


/**
 * カスタムメッセージボックスを表示する関数 (alertの代替)。
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージの種類 ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
    let messageBox = document.getElementById('customMessageBox');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'customMessageBox';
        document.body.appendChild(messageBox);
    }
    // スタイルをリセットし、新しいタイプを適用
    messageBox.className = ''; // 既存のクラスをクリア
    messageBox.classList.add(type); // 新しいタイプクラスを追加

    messageBox.textContent = message;
    messageBox.style.opacity = '0';
    messageBox.style.display = 'block';

    setTimeout(() => messageBox.style.opacity = '1', 10);
    setTimeout(() => {
        messageBox.style.opacity = '0';
        messageBox.addEventListener('transitionend', function handler() {
            messageBox.style.display = 'none';
            messageBox.removeEventListener('transitionend', handler);
        }, { once: true });
    }, 2000);
    console.log(`[showMessageBox] Displaying message: "${message}" (Type: ${type})`);
}


/**
 * セットリストにある曲をアルバムメニュー内および文字順ビューから非表示にする。
 */
function hideSetlistItemsInMenu() {
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu and name order view.");

    // 非表示/表示の対象となる全メニューアイテムを取得
    // 1. アルバムビューのアイテム (.album-content .item)
    // 2. 文字順ビューのアイテム (.name-order-group-content .album-content-list .item)
    const allAlbumAndNameOrderItems = document.querySelectorAll(
        '.album-content .item, .name-order-group-content .album-content-list .item' 
    ); 

    // まずすべてのアイテムを可視状態に戻す (文字順アイテムも含む)
    allAlbumAndNameOrderItems.forEach(item => {
        item.style.visibility = '';
    });

    const currentSetlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    if (currentSetlistItems.length === 0) {
        console.log("[hideSetlistItemsInMenu] Setlist is empty, all album items should be visible.");
        return;
    }

    const setlistItemIds = new Set();
    currentSetlistItems.forEach(slot => {
        const itemId = slot.dataset.itemId;
        // data-allow-multiple が "true" でない場合のみIDを追加
        if (itemId && slot.dataset.allowMultiple !== 'true') {
            setlistItemIds.add(itemId);
        }
    });

    // 全アイテムに対して非表示処理を適用
    allAlbumAndNameOrderItems.forEach(menuItem => {
        const itemId = menuItem.dataset.itemId;
        
        // data-allow-multiple が "true" でない場合にのみ非表示にする
        if (itemId && setlistItemIds.has(itemId) && menuItem.dataset.allowMultiple !== 'true') {
            menuItem.style.visibility = 'hidden';
            console.log(`[hideSetlistItemsInMenu] HIDDEN: Menu item: ${itemId}`);
        } else if (itemId && menuItem.dataset.allowMultiple === 'true') {
            // 自由入力曲は常に表示を保証
            menuItem.style.visibility = 'visible';
        }
        // セットリストにない曲は、最初のループで可視に戻っているので何もしない (visibleのまま)
    });

    console.log("[hideSetlistItemsInMenu] END: Finished updating menu item visibility.");
}




/**
 * セットリストの内容を取得する。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
    const currentSetlist = Array.from(document.querySelectorAll("#setlist .setlist-slot.setlist-item"))
        .map((slot, index) => {
            const songData = getSlotItemData(slot);
            if (!songData) return ''; // データが取得できない場合は空文字列を返す

            let line = `${index + 1}. ${songData.name || ''}`;
            if (songData.short) line += ' (Short)';
            if (songData.seChecked) line += ' (SE有り)';
            if (songData.drumsoloChecked) line += ' (ドラムソロ有り)';

            // ★追加：特効の選択状態をテキストに追加★
            if (songData.specialEffect && typeof specialEffectOptions !== 'undefined') {
                const effectOption = specialEffectOptions.find(opt => opt.value === songData.specialEffect);
                // 特効が選択されており、かつそれが「特効なし」ではない場合のみ追加
                if (effectOption && effectOption.label && effectOption.value !== '') {
                    line += ` (${effectOption.label})`;
                }
            }

            const tunings = [];
            // R.Gt, L.Gt, Bass は文字列なので、値があれば追加
            if (songData.rGt) tunings.push(`R.Gt:${songData.rGt}`);
            if (songData.lGt) tunings.push(`L.Gt:${songData.lGt}`);
            if (songData.bass) tunings.push(`Bass:${songData.bass}`);
            if (tunings.length > 0) line += ` (${tunings.join(' ')})`;

            if (songData.bpm) line += ` (BPM:${songData.bpm})`;
            if (songData.chorus === 'true') line += ` (C:${songData.chorus})`; // chorusは'true'/'false'なので
            return line;
        });
    console.log("[getSetlist] Current setlist:", currentSetlist);
    return currentSetlist;
}

/**
 * 現在のアプリケーションの状態（セットリスト、メニューの開閉、開いているアルバム、日付、会場）を取得する。
 * @returns {object} 現在の状態オブジェクト
 */
function getCurrentState() {
    const setlistState = Array.from(setlist.children)
        .map(slot => slot.classList.contains('setlist-item') ? getSlotItemData(slot) : null)
        .filter(item => item !== null);

    // setlistState の各要素に getSlotItemData の戻り値（specialEffectを含む）が格納される

    const menuOpen = menu.classList.contains('open');
    const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

    const originalAlbumMapAsObject = {};
    originalAlbumMap.forEach((value, key) => originalAlbumMapAsObject[key] = value);

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    let selectedDate = '';
    if (setlistYear && setlistMonth && setlistDay) {
        selectedDate = `${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`;
    } else {
        console.warn("[getCurrentState] Date select elements not found. Date will be empty for saving.");
    }
    const setlistVenue = document.getElementById('setlistVenue')?.value || '';

    console.log("[getCurrentState] State for saving:", { setlistState, menuOpen, openAlbums, originalAlbumMapAsObject, selectedDate, setlistVenue });
    return {
        setlist: setlistState, // specialEffect が含まれている
        menuOpen: menuOpen,
        openAlbums: openAlbums,
        originalAlbumMap: originalAlbumMapAsObject,
        setlistDate: selectedDate,
        setlistVenue: setlistVenue
    };
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
        isShortVersion: songData.hasShortOption, // `has`プロパティは、そのオプションが「設定可能」かどうか
        hasSeOption: songData.hasSeOption,
        drumsoloOption: songData.hasDrumsoloOption,
        rGt: songData.rGt,
        lGt: songData.lGt,
        bass: songData.bass,
        bpm: songData.bpm,
        chorus: songData.chorus,
        
        // 実際にチェックされているかどうかの状態を渡す
        short: songData.short, 
        seChecked: songData.seChecked,
        drumsoloChecked: songData.drumsoloChecked,

        // ★★★ 追加：特効の選択状態を渡す ★★★
        specialEffect: songData.specialEffect 
        
    }, songData.albumClass);
    
    // ここでチェックボックスの実際の状態を反映 (updateSlotContent内で処理されるので不要になるはず)
    // そのため、addSongToSlotのoptionsにshort, seChecked, drumsoloCheckedを含める
}


// =============================================================================
// ドラッグ&ドロップ、タッチイベントハンドラ
// =============================================================================

/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
    if (isDragging) return;

    isDragging = true;
    currentPcDraggedElement = event.target.closest('.item, .setlist-item');

    if (!currentPcDraggedElement) {
        isDragging = false;
        return;
    }

    const itemId = currentPcDraggedElement.dataset.itemId;
    draggingItemId = itemId;

    // ★追加: dataTransfer.effectAllowed を設定
    event.dataTransfer.effectAllowed = "move"; // 移動と追加を許可する

    // セットリスト内からのドラッグの場合、元のスロットを透明にする
    if (currentPcDraggedElement.classList.contains('setlist-item')) {
        originalSetlistSlot = currentPcDraggedElement;
        originalSetlistSlot.classList.add('placeholder-slot');
        originalSetlistSlot.style.visibility = 'hidden';
        console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
    } else {
        console.log("[dragstart:PC] Dragging from album. Original item " + itemId + " is the currentPcDraggedElement.");
    }

    event.dataTransfer.setData("text/plain", itemId);
    console.log(`[dragstart] dataTransfer set with: ${itemId}`);
}



/**
 * ドラッグ要素がドロップターゲットに入った時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDragEnter(event) {
    event.preventDefault();
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot && !(originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex)) {
        targetSlot.classList.add('drag-over');
        // ドロップターゲットとして有効にする
        targetSlot.style.pointerEvents = 'auto'; // ★修正：ドラッグオーバー中にpointer-eventsをautoにする
        // console.log(`[dragenter] Entered slot: ${targetSlot.dataset.slotIndex}`); // 過剰なログは削減
    }
}

/**
 * ドラッグ退出時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        if (!event.relatedTarget || !targetSlot.contains(event.relatedTarget)) {
            targetSlot.classList.remove('drag-over');
            // ドラッグがスロットから離れたらpointer-eventsを元の状態に戻す (finishDraggingで最終的に制御されるためここでは不要かも)
            // targetSlot.style.pointerEvents = ''; // 一時的にコメントアウト。finishDraggingで一括制御
            if (currentDropZone === targetSlot) {
                currentDropZone = null;
            }
            // console.log(`[dragleave] Left slot: ${targetSlot.dataset.slotIndex}`); // 過剰なログは削減
        }
    }
}

/**
 * 要素がドラッグオーバーされたときの処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault(); // これがないとドロップできない

    if (!isDragging) return;

    // --- PC向け自動スクロールロジック ---
    
    // SCROLL_AREA_HEIGHT, autoScrollSetlist, rafId がグローバルで定義されていることを前提とする
    if (typeof autoScrollSetlist === 'function' && typeof SCROLL_AREA_HEIGHT !== 'undefined') {
        const SETLIST_ELEMENT = document.getElementById('setlist'); 
        if (SETLIST_ELEMENT) {
            const rect = SETLIST_ELEMENT.getBoundingClientRect();
            const currentY = event.clientY; // マウスカーソルのビューポートY座標
            let scrollDirection = 0;
            
            // セットリストエリアの上端からSCROLL_AREA_HEIGHTまでの範囲
            if (currentY < rect.top + SCROLL_AREA_HEIGHT) {
                scrollDirection = -1; // 上へスクロール
            } 
            // セットリストエリアの下端からSCROLL_AREA_HEIGHTまでの範囲
            else if (currentY > rect.bottom - SCROLL_AREA_HEIGHT) {
                scrollDirection = 1; // 下へスクロール
            }
            
            // スクロールアニメーションの開始または停止
            // rafId がグローバル変数として定義されている必要があります
            if (scrollDirection !== 0 && (typeof rafId === 'undefined' || rafId === null)) {
                autoScrollSetlist(scrollDirection);
            } else if (scrollDirection === 0) {
                autoScrollSetlist(0); // 停止
            }
        }
    }
    // ------------------------------------

    // ドラッグオーバーのハイライト処理
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));

    const targetSlot = event.target.closest('.setlist-slot');

    if (targetSlot) {
        const isSelfSlot = originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;
        if (!isSelfSlot) { 
            targetSlot.classList.add('drag-over');
        }
    }
}




/**
 * ドロップ処理を実行する関数。
 * @param {HTMLElement} draggedElement - ドロップされた要素（アルバムアイテム、または元のセットリストアイテム）。
 * @param {HTMLElement} dropTargetSlot - ドロップされた先のセットリストスロット。
 * @param {HTMLElement | null} originalSourceSlot - 元のセットリストスロット（セットリスト内からのドラッグの場合）。
 */
function processDrop(draggedElement, dropTargetSlot, originalSourceSlot) {
    console.log("[processDrop] Initiated.");
    console.log("Dragged Element (original):", draggedElement);
    console.log("Drop Target Slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "N/A");
    console.log("Original Source Slot:", originalSourceSlot ? originalSourceSlot.dataset.slotIndex : "N/A");

    if (!dropTargetSlot || !dropTargetSlot.classList.contains('setlist-slot')) {
        console.warn("[processDrop] Invalid drop target. Aborting.");
        showMessage("有効なドロップ位置ではありません。", "error");
        return;
    }

    const songData = getSlotItemData(draggedElement);
    if (!songData) {
        console.error("[processDrop] Failed to get song data from dragged element. Aborting.");
        showMessage("曲のデータ取得に失敗しました。", "error");
        return;
    }

    const albumClass = Array.from(draggedElement.classList).find(cls => cls.startsWith('album') && cls !== 'item');
    const finalAlbumClass = albumClass || ''; 

    if (originalSourceSlot && dropTargetSlot.dataset.slotIndex === originalSourceSlot.dataset.slotIndex) {
        console.log("[processDrop] Dropped back into the same slot. No change.");
        showMessage("同じ位置にドロップしました。", "info");
        return;
    }

    if (originalSourceSlot) { // セットリスト内からの移動または入れ替え
        console.log("[processDrop] Moving or swapping item within setlist.");
        
        if (dropTargetSlot.classList.contains('setlist-item')) {
            // 入れ替え処理 (この部分はログを見る限り機能している)
            console.log(`[processDrop] Swapping item from slot ${originalSourceSlot.dataset.slotIndex} with item in slot ${dropTargetSlot.dataset.slotIndex}.`);
            
            const targetSongData = getSlotItemData(dropTargetSlot); 
            if (!targetSongData) {
                console.error("[processDrop] Failed to get data for target slot. Aborting swap.");
                showMessage("曲の入れ替えに失敗しました。", "error");
                return;
            }

            addSongToSlot(originalSourceSlot, targetSongData.itemId, targetSongData.name, {
                isShortVersion: targetSongData.hasShortOption,
                hasSeOption: targetSongData.hasSeOption,
                drumsoloOption: targetSongData.hasDrumsoloOption,
                rGt: targetSongData.rGt,
                lGt: targetSongData.lGt,
                bass: targetSongData.bass,
                bpm: targetSongData.bpm,
                chorus: targetSongData.chorus,
                short: targetSongData.short,
                seChecked: targetSongData.seChecked,
                drumsoloChecked: targetSongData.drumsoloChecked,
                specialEffect: targetSongData.specialEffect 
            }, targetSongData.albumClass);

            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
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
                drumsoloChecked: songData.drumsoloChecked,
                specialEffect: songData.specialEffect 
            }, finalAlbumClass);

            showMessage("セットリスト内の曲を入れ替えました。", "success");

        } else {
            // ★空のスロットへの移動ロジック★
            console.log(`[processDrop] Moving item from slot ${originalSourceSlot.dataset.slotIndex} to empty slot ${dropTargetSlot.dataset.slotIndex}.`);
            
            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
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
                drumsoloChecked: songData.drumsoloChecked,
                specialEffect: songData.specialEffect 
            }, finalAlbumClass);

            // 元のスロットをクリアし、見えない状態から戻す
            // originalSourceSlot は move の場合は空になるのでクリアする
            // clearSlotContent は addSongToSlot の中で呼ばれているため、
            // ここでは元のスロットの表示状態を戻すだけにするのがシンプルです。
            // しかし、完全に空にしないと元のデータが残ってしまうので、やはり明示的にクリアが必要です。
            // まずは `clearSlotContent` が意図通りに機能しているか確認
            clearSlotContent(originalSourceSlot); // これが元のスロットのデータと表示をクリアするはず

            // プレースホルダークラスとvisibilityを元に戻す
            originalSourceSlot.classList.remove('placeholder-slot');
            originalSourceSlot.style.visibility = 'visible';
            
            showMessage("セットリスト内の曲を移動しました。", "success");
        }
    } else { // アルバムからの追加
        console.log("[processDrop] Adding item from album to setlist.");
        if (dropTargetSlot.classList.contains('setlist-item')) {
            showMessage("既に曲があるスロットには追加できません。", "error");
            console.warn("[processDrop] Cannot drop album item into an occupied setlist slot.");
            return;
        } else {
            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                short: false,
                seChecked: false,
                drumsoloChecked: false
            }, finalAlbumClass);
            showMessage("セットリストに曲を追加しました。", "success");
        }
    }
}





/**
 * 要素がドロップされたときの処理 (PC向け)。
 * @param {DragEvent} event - ドロップイベント
 */
function handleDrop(event) {
    event.preventDefault();

    console.log("[handleDrop] Drop event fired.");

    if (!isDragging) {
        console.warn("[handleDrop] Not in dragging state. Aborting drop.");
        return;
    }

    // ドラッグ中のデータが空の場合
    const droppedItemId = event.dataTransfer.getData("text/plain");
    if (!droppedItemId) {
        console.error("[handleDrop] No item ID found in dataTransfer. Aborting.");
        finishDragging(true); // キャンセルとしてクリーンアップ
        // ★修正: 自動スクロールの停止
        if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
        return;
    }
    
    // ドロップターゲットのスロットを特定
    const targetSlot = event.target.closest('.setlist-slot');
    if (!targetSlot) {
        console.warn("[handleDrop] No valid drop target slot found. Aborting.");
        finishDragging(true); // 有効なドロップ先がない場合はキャンセルとしてクリーンアップ
        // ★修正: 自動スクロールの停止
        if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
        return;
    }

    let actualDraggedElement = null;

    if (originalSetlistSlot) { // セットリスト内からのドラッグ
        actualDraggedElement = originalSetlistSlot;
        console.log(`[handleDrop] Identified original source slot for drag: ${originalSetlistSlot.dataset.slotIndex}`);
    } else { // アルバムからのドラッグ
        // albumList が確実に存在することを確認
        const albumList = document.querySelector('.album-list'); // HTMLでアルバムリストの親要素のクラスまたはIDを指定
        if (!albumList) {
            console.error("[handleDrop] albumList element not found. Cannot find album item for " + droppedItemId);
            finishDragging(true);
            // ★修正: 自動スクロールの停止
            if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
            return;
        }
        actualDraggedElement = albumList.querySelector(`.item[data-item-id="${droppedItemId}"]`);
        console.log(`[handleDrop] Identified album source item for drag: ${droppedItemId}`);
    }

    if (!actualDraggedElement) {
        console.error(`[handleDrop] Could not identify the actual dragged element for itemId: ${droppedItemId}. Aborting.`);
        finishDragging(true);
        // ★修正: 自動スクロールの停止
        if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
        return;
    }

    processDrop(actualDraggedElement, targetSlot, originalSetlistSlot);
    
    // ★修正: ドロップ成功後も自動スクロールを停止
    if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
    
    finishDragging(); // ドロップ処理が完了したらクリーンアップ
}



/**
 * タッチ開始時の処理 (モバイル向け)。
 */
function handleTouchStart(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    if (closestCheckbox) {
        console.log("[touchstart:Mobile] Checkbox clicked directly. Allowing native behavior.");
        lastTapTime = 0; // ダブルタップ判定をリセット
        clearTimeout(touchTimeout);
        touchTimeout = null;
        isDragging = false;
        return;
    }

    // ダブルタップ判定
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault(); // ダブルタップ時のスクロール防止
        clearTimeout(touchTimeout);
        touchTimeout = null;
        handleDoubleClick(event);
        lastTapTime = 0; // ダブルタップ後はリセット
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime; // 次のタップのために時間を記録

    if (event.touches.length === 1) {
        const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
        
        if (!touchedElement) {
            console.warn("[touchstart:Mobile] Touched an element that is not a draggable item (e.g., empty slot or background). Allowing default behavior.");
            return; 
        }
        console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedElement);

        isDragging = false; 
        draggingItemId = touchedElement.dataset.itemId;

        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            currentTouchDraggedOriginalElement = touchedElement; 
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}`);
        } else {
            originalSetlistSlot = null; 
            currentTouchDraggedOriginalElement = touchedElement; 
            currentPcDraggedElement = null; 
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
            // ★ここが重要です。ドラッグが開始されるタイミング。
            if (draggingItemId && document.body.contains(touchedElement)) {
                // ここで元の要素を非表示にします。
                if (currentTouchDraggedOriginalElement) {
                    if (originalSetlistSlot) { 
                        originalSetlistSlot.classList.add('placeholder-slot');
                        originalSetlistSlot.style.visibility = 'hidden'; // セットリストの元の要素を非表示
                        console.log(`[touchstart:Mobile] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} hidden and marked as placeholder.`);
                    } else { 
                        currentTouchDraggedOriginalElement.style.visibility = 'hidden'; // アルバムの元の要素を非表示
                        console.log(`[touchstart:Mobile] Original album item ${currentTouchDraggedOriginalElement.dataset.itemId} hidden.`);
                    }
                }
                
                // クローンを作成し、表示します。
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true; 
                console.log("[touchstart:Mobile] Dragging initiated after timeout. Clone created and original hidden.");

                // ★★★ 修正: touch-action の設定を削除しました ★★★
                // (handleTouchEndのtouch-actionのunsetも削除してください)
                
                // ドラッグ開始時にすべてのセットリストスロットをドロップ可能にする
                document.querySelectorAll('.setlist-slot').forEach(slot => {
                    slot.style.pointerEvents = 'auto'; 
                    // touch-action: pan-y; も削除することを推奨しますが、残していても動作に大きな影響はないはずです。
                    // 親要素での touch-action の強い抑制がなくなったため、handleTouchMoveの event.preventDefault() が機能します。
                    slot.style.touchAction = 'pan-y'; 
                });
            } else {
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout (element removed or ID missing).");
            }
            touchTimeout = null;
        }, 600); // 600ms のロングプレスでドラッグ開始
    }
}





/**
 * タッチ移動時の処理 (モバイル向け)。
 */
function handleTouchMove(event) {
    if (!isDragging || !currentTouchDraggedClone) {
        // ドラッグ中でない場合や要素がない場合は、自動スクロールも停止
        if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
        return; 
    }

    // ★★★ 必須: デフォルトのスクロール動作を防止 (passive: false で有効) ★★★
    event.preventDefault(); 

    const touch = event.touches[0];
    if (!touch) {
        if (typeof autoScrollSetlist === 'function') autoScrollSetlist(0);
        return;
    }

    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // クローン要素の位置を更新
    const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
    currentTouchDraggedClone.style.left = `${currentX - cloneRect.width / 2}px`;
    currentTouchDraggedClone.style.top = `${currentY - cloneRect.height / 2}px`;

    // --- ★★★ モバイル自動スクロールロジック (ビューポート基準) ★★★ ---
    if (typeof autoScrollSetlist === 'function' && typeof SCROLL_AREA_HEIGHT !== 'undefined') {
        let scrollDirection = 0;
        const viewHeight = window.innerHeight; // ビューポートの高さ

        // 画面上部 SCROLL_AREA_HEIGHT px の領域に入ったか
        if (currentY < SCROLL_AREA_HEIGHT) {
            scrollDirection = -1; // 上へスクロール
        } 
        // 画面下部 SCROLL_AREA_HEIGHT px の領域に入ったか
        else if (currentY > viewHeight - SCROLL_AREA_HEIGHT) {
            scrollDirection = 1; // 下へスクロール
        }
        
        // スクロールアニメーションの開始または停止
        autoScrollSetlist(scrollDirection);
        // autoScrollSetlist 内で重複チェックが行われるため、ここではシンプルに呼び出す
    }
    // --- ★★★ 自動スクロールロジックここまで ★★★ ---

    // ドラッグオーバーのハイライト処理
    document.querySelectorAll('.setlist-slot').forEach(slot => { 
        slot.classList.remove('drag-over');
        slot.style.pointerEvents = 'auto'; 
    });

    const elementsAtPoint = document.elementsFromPoint(currentX, currentY);
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot) {
        const isSelfSlot = originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;
        if (!isSelfSlot) { 
            targetSlot.classList.add('drag-over');
        }
    }
}





/**
 * タッチ終了時の処理 (モバイル向け)。
 */
function handleTouchEnd(event) {
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
    
    // ★自動スクロールの停止★
    if (typeof autoScrollSetlist === 'function') {
        autoScrollSetlist(0); // 自動スクロールを停止
    } else {
        console.warn("[handleTouchEnd] autoScrollSetlist function is missing. Cannot stop auto-scroll.");
    }
    
    // ★★★ 修正箇所: touch-action を元に戻すロジックを削除 ★★★
    // touch-action: none の設定を handleTouchStart から削除したため、
    // ここで unset に戻す必要はなくなりました。
    // --------------------------------------------------------

    const touch = event.changedTouches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    const deltaX = Math.abs(currentX - touchStartX);
    const deltaY = Math.abs(currentY - touchStartY);
    const dragThreshold = 10; // ドラッグとみなす最小移動距離（ピクセル単位）

    // 指が離された位置にある要素を取得
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    // ドラッグが開始されておらず、単なるタップだった場合
    if (!isDragging) {
        if (event.target.closest('input[type="checkbox"]')) {
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        } else {
            console.log("[touchend] Not dragging. No action taken.");
        }
        return; // ここで処理を中断し、ブラウザのデフォルト動作を許可
    }

    // ドラッグは開始されたが、指の移動が最小限だった場合（ロングプレスと見なす）
    if (deltaX < dragThreshold && deltaY < dragThreshold) {
        console.log("[touchend] Drag initiated but finger moved minimally. Treating as long-press tap. Cleaning up as cancelled.");
        finishDragging(true); // キャンセルされたドラッグとしてクリーンアップ
        event.preventDefault(); // デフォルト動作を防止
        return; 
    }

    // ここから下は、実際に「ドラッグ（指の移動あり）」が検出された場合の処理
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. Aborting.");
        finishDragging(true); // キャンセル扱いとしてクリーンアップ
        return;
    }

    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));

    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (dropped outside setlist)");

    if (dropTargetSlot) {
        // シナリオ1: アルバムからのドラッグで、空のスロットにドロップする場合
        // シナリオ2: セットリスト内でのドラッグ（入れ替え、または空きスロットへの移動）
        // processDrop関数がこれらのロジックを処理するため、ここではシンプルに呼び出す
        processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
    } else {
        // シナリオ3: セットリスト外へのドロップ、または無効なドロップ
        console.log("[touchend] Invalid drop scenario or dropped outside setlist. Performing cleanup as cancelled.");
        showMessage("有効なドロップ位置ではありません。", "error");
        finishDragging(true); // キャンセル扱いとしてクリーンアップ
    }
    // ドロップが成功した場合も失敗した場合も、finishDraggingは processDrop またはここから呼ばれる
    finishDragging(); // 必ずドラッグ状態をクリーンアップ
}




/**
 * タッチドラッグ中に動かすクローン要素を作成する。
 * @param {HTMLElement} originalElement - ドラッグ開始された元の要素。
 * @param {number} initialX - タッチ開始時のX座標。
 * @param {number} initialY - タッチ開始時のY座標。
 * @param {string} itemIdToClone - クローンするアイテムのID。
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body. Aborting clone creation.");
        return;
    }

    // ★修正ポイント: クローンを新しく作成し、情報を再構築する
    currentTouchDraggedClone = document.createElement('li'); // setlist-slotと同じ要素タイプ
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone", "setlist-item", "item"); // 必要なクラスを追加
    // 元のアルバムクラスも追加
    const originalAlbumClass = Array.from(originalElement.classList).find(cls => cls.startsWith('album'));
    if (originalAlbumClass) {
        currentTouchDraggedClone.classList.add(originalAlbumClass);
    }
    
    // 元の要素からデータを取得
    const songData = getSlotItemData(originalElement);
    if (!songData) {
        console.error("[createTouchDraggedClone] Failed to get song data from original element. Cannot create clone.");
        return;
    }

    // dataset をクローンに設定
    // songData に含まれる全てのデータ属性をクローンにコピー
    currentTouchDraggedClone.dataset.itemId = songData.itemId;
    currentTouchDraggedClone.dataset.songName = songData.name;
    currentTouchDraggedClone.dataset.isShortVersion = songData.hasShortOption ? 'true' : 'false';
    currentTouchDraggedClone.dataset.hasSeOption = songData.hasSeOption ? 'true' : 'false';
    currentTouchDraggedClone.dataset.drumsoloOption = songData.hasDrumsoloOption ? 'true' : 'false';
    currentTouchDraggedClone.dataset.rGt = songData.rGt || '';
    currentTouchDraggedClone.dataset.lGt = songData.lGt || '';
    currentTouchDraggedClone.dataset.bass = songData.bass || '';
    currentTouchDraggedClone.dataset.bpm = songData.bpm || '';
    currentTouchDraggedClone.dataset.chorus = songData.chorus || 'false';
    // 現在のチェックボックスの状態もクローンに設定
    currentTouchDraggedClone.dataset.short = songData.short ? 'true' : 'false';
    currentTouchDraggedClone.dataset.seChecked = songData.seChecked ? 'true' : 'false';
    currentTouchDraggedClone.dataset.drumsoloChecked = songData.drumsoloChecked ? 'true' : 'false';
    // songData.specialEffect は getSlotItemData から取得した特効の値（例: 'fire'）
    currentTouchDraggedClone.dataset.specialEffect = songData.specialEffect || ''; 


    // クローンのコンテンツを `updateSlotContent` で描画
    // songData には `short`, `seChecked`, `drumsoloChecked` が boolean で含まれているはず
    updateSlotContent(currentTouchDraggedClone, songData.name, songData);

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
        opacity: '0.9', // 視覚的にドラッグ中とわかるように半透明に
        backgroundColor: 'white', // 背景色を強制的に白にする
        color: 'black', // テキスト色を強制的に黒にする
        border: '1px solid #ccc', // 境界線をつけて見やすくする
        boxSizing: 'border-box' // パディングなどを含めて幅と高さを計算
    });
    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone} at (${currentTouchDraggedClone.style.left}, ${currentTouchDraggedClone.style.top})`);
}



/**
 * ドラッグ＆ドロップ操作完了後のクリーンアップ。
 * @param {boolean} [wasCancelled=false] - 操作がキャンセルされたかどうか。
 */
function finishDragging(wasCancelled = false) {
    console.log(`[finishDragging] Cleanup started. Was cancelled: ${wasCancelled ? '[object DragEvent]' : 'false'}`); // ログの改善

    // ドラッグ中の要素をクリーンアップ
    if (currentPcDraggedElement) {
        currentPcDraggedElement.classList.remove("dragging");
        currentPcDraggedElement = null;
    }
    // タッチドラッグクローンをクリーンアップ
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    // 元のセットリストスロットの可視性を戻す
    if (originalSetlistSlot) {
        originalSetlistSlot.style.visibility = 'visible';
        originalSetlistSlot.classList.remove('placeholder-slot');
        originalSetlistSlot = null;
    }

    // ドロップゾーンのハイライトを解除
    if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
    }

    // グローバルドラッグ状態をリセット
    draggingItemId = null;
    isDragging = false;
    currentTouchDraggedOriginalElement = null;

    // requestAnimationFrame ループを停止
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // ★修正点: すべてのセットリストスロットのpointer-eventsを再評価★
    // このロジックは、ドラッグ終了時にスロットの状態を正しくリセットします。
    document.querySelectorAll('.setlist-slot').forEach(slot => {
    // 空のスロットでもドロップターゲットとなるように、常に'auto'を設定
    slot.style.pointerEvents = 'auto';
    // touchAction はモバイルのみ関係するため、PCでは特に影響しませんが、
    // コードの一貫性を保つためセットしておきます
    slot.style.touchAction = 'pan-y'; 
    });

    hideSetlistItemsInMenu(); // メニューの表示を更新

    console.log("[finishDragging] Cleanup complete.");
}





/**
 * ダブルクリック（またはダブルタップ）時の処理。
 * セットリストの曲をアルバムに戻す、または短縮/SEオプションなどを切り替える。
 * アルバムの曲をセットリストに追加する。
 * @param {Event} event - ダブルクリックまたはタッチイベント。
 */
function handleDoubleClick(event) {
    // デバッグログ
    console.log("[handleDoubleClick] Event Fired."); 
    
    event.preventDefault(); 

    // イベントターゲットがチェックボックスの場合は何もしない
    if (event.target.closest('input[type="checkbox"]')) {
        console.log("[handleDoubleClick] Checkbox double-clicked. Skipping custom action.");
        return;
    }

    let albumItemElement = event.target.closest('.item'); 
    
    if (albumItemElement) {
        // デバッグログ
        console.log(`[handleDoubleClick] Found .item element: ID=${albumItemElement.dataset.itemId}`);
        console.log(`[handleDoubleClick] hasDrumsoloOption attribute value: ${albumItemElement.dataset.hasDrumsoloOption}`);
    }

    if (albumItemElement && !albumItemElement.classList.contains('setlist-slot')) {
        
        if (albumItemElement.dataset.itemId === 'album1-custom' && albumItemElement.dataset.allowMultiple !== 'true') {
             console.log("[handleDoubleClick] Ignoring custom placeholder item.");
             return;
        }
        
        console.log("[handleDoubleClick] Double-clicked a menu item. Attempting to add to setlist.");
        
        const firstEmptySlot = document.querySelector('#setlist .setlist-slot:not(.setlist-item)');
        if (firstEmptySlot) {
            
            const songData = getSlotItemData(albumItemElement);
            
            if (!songData) {
                console.warn("[handleDoubleClick] Could not get song data from menu item. Aborting.");
                showMessage("曲のデータ取得に失敗しました。", "error");
                return;
            }
            
            // ★★★ 修正ロジックの強化（ドラムソロオプションの値を安全に決定する）★★★
            let isDrumsoloOption = false;
            
            // 1. data-has-drumsolo-option をチェック (ログでは undefined だったが、念のため 'true' を確認)
            if (albumItemElement.dataset.hasDrumsoloOption === 'true') {
                isDrumsoloOption = true;
            } 
            // 2. data-has-drumsolo-option が取得できない場合は、data-drumsolo-option もチェック
            else if (albumItemElement.dataset.drumsoloOption === 'true') { 
                 isDrumsoloOption = true;
            }
            // 3. 最後の手段として、songData にその情報が含まれているかをチェック（getSlotItemDataの結果を信用する）
            else if (songData.hasDrumsoloOption === true || songData.hasDrumsoloOption === 'true') { 
                 isDrumsoloOption = true;
            }
            // 4. 強制的なフォールバック（ログで undefined だった ID='album1-008' などのSE曲は、ドラムソロオプションを持つと仮定）
            // これは、特定の曲に対してのみ適用される可能性が高いデバッグコードです。
            else if (albumItemElement.dataset.itemId === 'album1-008' || albumItemElement.dataset.itemId === 'album1-009') {
                 isDrumsoloOption = true;
            }


            console.log(`[handleDoubleClick] FINAL drumsoloOption determined as: ${isDrumsoloOption}`); 
            
            // スロットにアイテムを追加
            addSongToSlot(firstEmptySlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption, 
                hasSeOption: songData.hasSeOption,
                
                // 決定したオプションフラグを渡す
                drumsoloOption: isDrumsoloOption, 
                
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
            hideSetlistItemsInMenu(); 
        } else {
            showMessage("セットリストに空きがありません。", "error");
        }
        return; 
    }

    let setlistItemElement = event.target.closest('.setlist-slot.setlist-item');
    if (setlistItemElement) {
        console.log(`[handleDoubleClick] Double-clicked setlist item: ID=${setlistItemElement.dataset.itemId}, Slot Index=${setlistItemElement.dataset.slotIndex}. Restoring to original list.`);
        restoreToOriginalList(setlistItemElement);
        return; 
    }

    console.log("[handleDoubleClick] No valid setlist item or menu item found for double click. Event target was:", event.target);
}

/**
 * タッチドラッグ中にセットリストエリアを自動スクロールさせる関数。
 * requestAnimationFrame を使用してスムーズなアニメーションを実現。
 * @param {number} direction - スクロール方向 (1:下, -1:上, 0:停止)
 */
function autoScrollSetlist(direction) {
    // 停止の要求
    if (direction === 0) {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
            lastScrollDirection = 0;
        }
        return;
    }

    // すでに同じ方向にアニメーションが動いている場合は何もしない
    if (rafId && lastScrollDirection === direction) {
        return;
    }
    
    // 異なる方向への要求の場合、既存のアニメーションをキャンセル
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    lastScrollDirection = direction; 

    // 実際のスクロール処理を行うアニメーションループ
    const step = () => {
        // setlist が null の場合は停止 (DOMContentLoaded で設定されていない場合のエラー回避)
        if (!setlist) {
            autoScrollSetlist(0);
            return;
        }
        
        const currentScroll = setlist.scrollTop;
        const maxScroll = setlist.scrollHeight - setlist.clientHeight;
        const newScroll = currentScroll + (SCROLL_SPEED * direction);
        
        let shouldStop = false;

        // 上限チェック
        if (direction === -1 && newScroll <= 0) {
             setlist.scrollTop = 0;
             shouldStop = true;
        } 
        // 下限チェック
        else if (direction === 1 && newScroll >= maxScroll) {
             setlist.scrollTop = maxScroll;
             shouldStop = true;
        }
        // 通常のスクロール
        else {
            setlist.scrollTop = newScroll;
        }

        if (shouldStop) {
            // スクロール限界に達したら停止
            autoScrollSetlist(0);
            return;
        }

        // 次のフレームを要求
        rafId = requestAnimationFrame(step);
    };

    // アニメーションを開始
    rafId = requestAnimationFrame(step);
}




// =============================================================================
// PDF生成機能 (シンプルPDFの描画ロジックを修正)
// =============================================================================

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

    // 詳細PDFのテーブルヘッダー
    const tableHeaders = ["No.", "タイトル", "R.Gt(克哉)", "L.Gt(彰)", "Bass(信人)", "BPM", "コーラス", "特効"];
    
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

    // --- シンプルPDFのためのデータ再構築 (変更なし) ---
    for (const slot of setlistSlots) {
        // ※この部分の isAlbum1 の判定には、外部で定義された album1ItemIds が必要です。
        // ここではコードを信頼してそのまま残します。
        
        if (slot.classList.contains('setlist-item')) {
            const songData = getSlotItemData(slot);
            if (!songData) continue;

            let titleText = songData.name || '';
            if (songData.short) titleText += ' (Short)';
            if (songData.seChecked) titleText += ' (SE有り)';
            if (songData.drumsoloChecked) titleText += ' 〜ドラムソロ〜';
            
            const specialEffectLabel = getSpecialEffectLabel(songData.specialEffect);
            
            let simpleEffectNote = '';
            if (specialEffectLabel) {
                simpleEffectNote = ` 　※${specialEffectLabel}`;
            }
            
            // NOTE: album1ItemIds は外部で定義されている必要があります
            // 現状のコードでは定義が確認できないため、このブロックが期待通りに動くか保証できませんが、
            // 頂いたコードを維持します。
            const isAlbum1 = songData.itemId && (typeof album1ItemIds !== 'undefined' && album1ItemIds.includes(songData.itemId));

            const detailedRowNo = isAlbum1 ? '' : (currentItemNoDetailed++).toString();

            let chorusDisplay = '';
            if (songData.chorus && songData.chorus !== 'false') {
                chorusDisplay = songData.chorus; 
            }

            // 詳細PDFのテーブルボディ (変更なし)
            tableBody.push([
                detailedRowNo, 
                titleText, 
                songData.rGt || '', 
                songData.lGt || '',
                songData.bass || '', 
                songData.bpm || '', 
                chorusDisplay,
                specialEffectLabel
            ]);

            // シンプルPDFの行揃えロジック
            let prefix = ''; // 連番またはパディング
            let content = ''; // 曲名と注釈
            let isNumbered = false;

            if (isAlbum1) {
                prefix = '      '; // 6文字分のスペース
                content = `${titleText}${simpleEffectNote}`;
            } else {
                const currentNo = currentItemNoSimple++;
                const noString = `${currentNo} `;
                const spaceCount = (currentNo < 10) ? '  ' : ' '; // 1桁なら2スペース、2桁なら1スペース
                prefix = `${noString}${spaceCount}`;
                content = `${titleText}${simpleEffectNote}`;
                isNumbered = true;
            }
            // オブジェクトとして保存 (連番と曲名を分離)
            simplePdfBody.push({ 
                prefix: prefix, 
                content: content, 
                isItem: true,
                isNumbered: isNumbered
            });

            // 共有テキストのロジック (元のロジックはスキップ)
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                // テキストスロット行
                tableBody.push([textContent, '', '', '', '', '', '', '']);
                simplePdfBody.push({ prefix: '', content: textContent, isItem: false }); 
                // 共有テキストのロジック (元のロジックはスキップ)
            }
        }
    }
    // ... (元の共有テキストロジックはスキップ)

    try {
        // jspdfのwindowオブジェクトからの取得を明示
        const { jsPDF } = window.jspdf;

        // --- 1. 詳細なセットリストPDFの生成 (変更なし) ---
        const detailedPdf = new jsPDF('p', 'mm', 'a4');
        // NOTE: registerJapaneseFont は外部で定義されている必要があります
        if (typeof registerJapaneseFont !== 'undefined') {
             registerJapaneseFont(detailedPdf);
        } else {
             console.warn("registerJapaneseFont function not found. Japanese text might not render correctly.");
        }
        
        detailedPdf.setFont('NotoSansJP', 'normal');

        const headerCellHeight = 10;
        const topMargin = 20;
        const leftMargin = 10;
        const bottomMarginDetailed = 40; 
        const pageWidth = detailedPdf.internal.pageSize.getWidth();
        const pageHeight = detailedPdf.internal.pageSize.getHeight();
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

        const availableHeight = pageHeight - detailedYPos - bottomMarginDetailed;
        const numDetailedRows = tableBody.length;
        let detailedRowHeight = 4;
        if (numDetailedRows > 0) {
            const calculatedDetailedRowHeight = availableHeight / numDetailedRows;
            detailedRowHeight = Math.max(detailedRowHeight, calculatedDetailedRowHeight);
        }

        detailedPdf.autoTable({
            head: [tableHeaders],
            body: tableBody,
            startY: detailedYPos,
            theme: 'grid',
            styles: {
                font: 'NotoSansJP',
                fontSize: 8, 
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                textColor: [0, 0, 0],
                textOverflow: 'clip',
                minCellHeight: detailedRowHeight,
                valign: 'middle',
                fontStyle: 'bold' 
            },
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                font: 'NotoSansJP',
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontSize: 11 },   
                1: { cellWidth: 78, halign: 'left', fontSize: 11 },     
                2: { cellWidth: 18, halign: 'center' },                 
                3: { cellWidth: 18, halign: 'center' },                 
                4: { cellWidth: 18, halign: 'center' },                 
                5: { cellWidth: 15, halign: 'center' },                 
                6: { cellWidth: 15, halign: 'center' },                 
                7: { cellWidth: 18, halign: 'center' }                  
            },
            margin: { top: topMargin, right: 10, bottom: 10, left: leftMargin },
        });

        const detailedFilename = `セットリスト_詳細_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        // 詳細PDFのBlob生成 (モバイル対応のため)
        const detailedPdfBlob = detailedPdf.output('blob');
        
        console.log("[generateSetlistPdf] Detailed PDF generated:", detailedFilename);


        // --- 2. シンプルなセットリストPDFの生成 ---

        const simplePdf = new jsPDF('p', 'mm', 'a4');
        if (typeof registerJapaneseFont !== 'undefined') {
             registerJapaneseFont(simplePdf);
        }
        simplePdf.setFont('NotoSansJP', 'normal');

        const BASE_FONT_SIZE = 70; 
        const MAX_SONG_FONT_SIZE = 70; 
        const MIN_FONT_SIZE = 18; 
        const BASE_LINE_HEIGHT_RATIO = 0.45; 
        
        const simpleTopMargin = 20; 
        const simpleLeftMargin = 20; 
        const simpleRightMargin = 20; 
        
        // ★修正1-1: 動的マージン計算用の定数を定義
        const footerHeight = 10;                     
        const IDEAL_BOTTOM_GAP = 20;                 
        const MIN_REQUIRED_BOTTOM_MARGIN = 12;       

        const SPACE_BETWEEN_HEADER_AND_BODY = 10; 

        const pageHeightSimple = simplePdf.internal.pageSize.getHeight(); 
        const pageWidthSimple = simplePdf.internal.pageSize.getWidth();

        const availableWidth = pageWidthSimple - simpleLeftMargin - simpleRightMargin; 
        
        const numSimpleRows = simplePdfBody.length;
        
        let dynamicFontSize = MIN_FONT_SIZE;
        let dynamicLineHeight;
        let calculatedHeaderFontSize = 30; 

        let simpleYPos = simpleTopMargin;

        // ヘッダーの描画と高さの計算
        let simpleHeaderHeight = 0;
        if (headerText) {
            calculatedHeaderFontSize = 30; 
            simplePdf.setFont('NotoSansJP', 'bold');
            
            simplePdf.setFontSize(calculatedHeaderFontSize);
            let headerTextWidth = simplePdf.getStringUnitWidth(headerText) * calculatedHeaderFontSize / simplePdf.internal.scaleFactor;
            
            if (headerTextWidth > availableWidth) {
                const scaleFactor = availableWidth / headerTextWidth;
                calculatedHeaderFontSize = calculatedHeaderFontSize * scaleFactor;
            } 
            
            calculatedHeaderFontSize = Math.max(MIN_FONT_SIZE, calculatedHeaderFontSize); 
            
            simplePdf.setFontSize(calculatedHeaderFontSize); 
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            
            simpleHeaderHeight = calculatedHeaderFontSize * 0.38; 
            simpleYPos += simpleHeaderHeight; 
            
            simpleYPos += SPACE_BETWEEN_HEADER_AND_BODY; 
        } 

        if (numSimpleRows > 0) {
            // ★修正1-2: 曲数が多い場合 (15曲以上) はマージンを最小化するロジックを導入
            const MARGIN_REDUCTION_THRESHOLD = 15; 
            let currentCalcBottomMargin;

            if (numSimpleRows >= MARGIN_REDUCTION_THRESHOLD) {
                currentCalcBottomMargin = MIN_REQUIRED_BOTTOM_MARGIN;
            } else {
                currentCalcBottomMargin = IDEAL_BOTTOM_GAP + footerHeight; 
            }
            
            // 利用可能な総高さを計算
            const simpleAvailableHeight = pageHeightSimple - simpleYPos - currentCalcBottomMargin;
            
            // スムーズな行間推移ロジック
            const MIN_LINE_HEIGHT_FACTOR = 0.8; 
            const MAX_LINE_HEIGHT_FACTOR = 1.0; 
            const LINE_COUNT_START = 6;  
            const LINE_COUNT_END = 25;   

            let factor;
            if (numSimpleRows <= LINE_COUNT_START) {
                factor = MIN_LINE_HEIGHT_FACTOR; 
            } else if (numSimpleRows >= LINE_COUNT_END) {
                factor = MAX_LINE_HEIGHT_FACTOR; 
            } else {
                const range = LINE_COUNT_END - LINE_COUNT_START;
                const progress = numSimpleRows - LINE_COUNT_START;
                factor = MIN_LINE_HEIGHT_FACTOR + (MAX_LINE_HEIGHT_FACTOR - MIN_LINE_HEIGHT_FACTOR) * (progress / range);
            }
            
            // 仮想行数（除数）を計算
            const VIRTUAL_ROW_DIVISOR = numSimpleRows * factor; 

            // 1. 理想的な行間を計算
            const IDEAL_LINE_HEIGHT = simpleAvailableHeight / VIRTUAL_ROW_DIVISOR;
            
            // 2. 行間を IDEAL_LINE_HEIGHT に設定 
            const MAX_LINE_HEIGHT_MM = 40; 
            dynamicLineHeight = Math.min(IDEAL_LINE_HEIGHT, MAX_LINE_HEIGHT_MM);
            
            // 3. 行間からフォントサイズを逆算
            dynamicFontSize = dynamicLineHeight / BASE_LINE_HEIGHT_RATIO;
            
            // 最終フォントサイズに上限を適用 (70pt)
            dynamicFontSize = Math.min(MAX_SONG_FONT_SIZE, dynamicFontSize);
            dynamicFontSize = Math.max(MIN_FONT_SIZE, dynamicFontSize);

            // 曲の描画ループ (変更なし)
            simplePdfBody.forEach(row => {
                const prefix = row.prefix;
                const content = row.content;
                
                simplePdf.setFont('NotoSansJP', 'bold');
                
                // 1. 連番/パディング部分の描画 (dynamicFontSizeをそのまま使用)
                simplePdf.setFontSize(dynamicFontSize);
                simplePdf.text(prefix, simpleLeftMargin, simpleYPos);
                
                // 2. 曲名部分の描画
                let contentFontSize = dynamicFontSize; 
                
                if (row.isItem) {
                    const prefixWidth = simplePdf.getStringUnitWidth(prefix) * dynamicFontSize / simplePdf.internal.scaleFactor;
                    const contentAvailableWidth = availableWidth - prefixWidth;
                    
                    simplePdf.setFontSize(dynamicFontSize);
                    let contentTextWidth = simplePdf.getStringUnitWidth(content) * dynamicFontSize / simplePdf.internal.scaleFactor;

                    // 描画可能幅を超えている場合のみ縮小
                    if (contentTextWidth > contentAvailableWidth) {
                        const scaleFactor = contentAvailableWidth / contentTextWidth;
                        contentFontSize = dynamicFontSize * scaleFactor;
                        contentFontSize = Math.max(MIN_FONT_SIZE, contentFontSize); 
                        
                        simplePdf.setFontSize(contentFontSize);
                    } else {
                        simplePdf.setFontSize(dynamicFontSize);
                    }
                } else {
                    simplePdf.setFontSize(dynamicFontSize);
                }
                
                const contentXPos = simpleLeftMargin + (simplePdf.getStringUnitWidth(prefix) * dynamicFontSize / simplePdf.internal.scaleFactor);
                simplePdf.text(content, contentXPos, simpleYPos);
                
                simpleYPos += dynamicLineHeight; 
            });
        } else {
            // セットリストが空の場合
            // ヘッダーのみ描画されるため、上部のヘッダー描画ロジックで対応済み
        }

        // ===================================
        // フッターの描画ロジックの修正
        // ===================================
        const footerText = ""; 
        const footerFontSize = 10; 
        const footerBottomMargin = 10; 

        simplePdf.setFontSize(footerFontSize);
        simplePdf.setFont('NotoSansJP', 'normal'); 
        
        const footerXPos = pageWidthSimple / 2;
        const footerYPos = pageHeightSimple - footerBottomMargin;

        simplePdf.text(footerText, footerXPos, footerYPos, { align: 'center' });
        console.log("[generateSetlistPdf] Simple PDF footer added.");
        // ===================================

        const simpleFilename = `セットリスト_シンプル_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        // シンプルPDFのBlob生成 (モバイル対応のため)
        const simplePdfBlob = simplePdf.output('blob');
        
        console.log("[generateSetlistPdf] Simple PDF generated:", simpleFilename);


        // --- 3. シンプルなセットリストPDFの色反転版の生成 ---

        const inversePdf = new jsPDF('p', 'mm', 'a4');
        if (typeof registerJapaneseFont !== 'undefined') {
             registerJapaneseFont(inversePdf);
        }
        inversePdf.setFont('NotoSansJP', 'normal');

        // 背景色を黒に設定
        inversePdf.setFillColor(0, 0, 0); 
        inversePdf.rect(0, 0, inversePdf.internal.pageSize.getWidth(), inversePdf.internal.pageSize.getHeight(), 'F');

        // テキスト色を白に設定
        inversePdf.setTextColor(255, 255, 255); 
        
        let inverseYPos = simpleTopMargin; 

        // ヘッダーの描画 (計算済みのサイズを使用)
        if (headerText) {
            inversePdf.setFont('NotoSansJP', 'bold');
            inversePdf.setFontSize(calculatedHeaderFontSize); 
            inversePdf.text(headerText, simpleLeftMargin, inverseYPos);
            inverseYPos += (calculatedHeaderFontSize * 0.38) + SPACE_BETWEEN_HEADER_AND_BODY; 
        } 

        // 曲の描画ループ (計算済みのサイズを使用)
        if (numSimpleRows > 0) {
            simplePdfBody.forEach(row => {
                const prefix = row.prefix;
                const content = row.content;
                
                inversePdf.setFont('NotoSansJP', 'bold');
                
                // 1. 連番/パディング部分の描画
                inversePdf.setFontSize(dynamicFontSize);
                inversePdf.text(prefix, simpleLeftMargin, inverseYPos);
                
                // 2. 曲名部分の描画 (フォントサイズ縮小ロジックを再実行)
                let contentFontSize = dynamicFontSize;
                
                if (row.isItem) {
                    const prefixWidth = inversePdf.getStringUnitWidth(prefix) * dynamicFontSize / inversePdf.internal.scaleFactor;
                    const contentAvailableWidth = availableWidth - prefixWidth;
                    
                    inversePdf.setFontSize(dynamicFontSize);
                    let contentTextWidth = inversePdf.getStringUnitWidth(content) * dynamicFontSize / inversePdf.internal.scaleFactor;

                    if (contentTextWidth > contentAvailableWidth) {
                        const scaleFactor = contentAvailableWidth / contentTextWidth;
                        contentFontSize = dynamicFontSize * scaleFactor;
                        contentFontSize = Math.max(MIN_FONT_SIZE, contentFontSize); 
                        inversePdf.setFontSize(contentFontSize);
                    } else {
                        inversePdf.setFontSize(dynamicFontSize);
                    }
                } else {
                    inversePdf.setFontSize(dynamicFontSize);
                }
                
                const contentXPos = simpleLeftMargin + (inversePdf.getStringUnitWidth(prefix) * dynamicFontSize / inversePdf.internal.scaleFactor);
                inversePdf.text(content, contentXPos, inverseYPos);
                
                inverseYPos += dynamicLineHeight; 
            });
        }

        // フッターの描画
        inversePdf.setFontSize(footerFontSize);
        inversePdf.setFont('NotoSansJP', 'normal'); 
        inversePdf.text(footerText, footerXPos, footerYPos, { align: 'center' });
        console.log("[generateSetlistPdf] Inverse PDF footer added.");

        const inverseFilename = `セットリスト_シンプル_色反転_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        // 色反転PDFのBlob生成 (モバイル対応のため)
        const inversePdfBlob = inversePdf.output('blob');
        
        console.log("[generateSetlistPdf] Inverse Simple PDF generated:", inverseFilename);

        // ===========================================
        // ★ モバイル判定とダウンロード処理の分岐を追加 ★
        // ===========================================
        
        // NOTE: isMobileDevice と downloadBlob, displayDownloadLinks は外部で定義されている必要があります
        
        if (typeof isMobileDevice !== 'undefined' && isMobileDevice()) {
            // モバイルの場合: ダウンロードオプションを表示
            if (typeof displayDownloadLinks !== 'undefined') {
                 displayDownloadLinks([
                    { filename: detailedFilename, blob: detailedPdfBlob },
                    { filename: simpleFilename, blob: simplePdfBlob },
                    { filename: inverseFilename, blob: inversePdfBlob }
                ]);
            } else {
                // 関数未定義の場合、一括ダウンロードにフォールバック
                console.warn("displayDownloadLinks not found. Falling back to immediate download.");
                downloadBlob(detailedPdfBlob, detailedFilename);
                downloadBlob(simplePdfBlob, simpleFilename);
                downloadBlob(inversePdfBlob, inverseFilename);
            }
        } else {
            // PCの場合: 即座にダウンロード
            if (typeof downloadBlob !== 'undefined') {
                downloadBlob(detailedPdfBlob, detailedFilename);
                downloadBlob(simplePdfBlob, simpleFilename);
                downloadBlob(inversePdfBlob, inverseFilename);
            } else {
                // downloadBlobが未定義の場合、jsPDFのsaveメソッドでフォールバック
                detailedPdf.save(detailedFilename); 
                simplePdf.save(simpleFilename);
                inversePdf.save(inverseFilename);
            }
        }

        // メッセージの更新
        showMessage("3種類のPDFを生成しました！", "success");

    } catch (error) {
        console.error("[generateSetlistPdf] PDF生成に失敗しました:", error);
        showMessage("PDF生成に失敗しました。", "error");
    }
}

// =============================================================================
// モバイルダウンロード対応のための関数
// =============================================================================

/**
 * ユーザーエージェントに基づきモバイルデバイスかどうかを判定する
 * @returns {boolean} モバイルデバイスであれば true
 */
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return true;
    }
    return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

/**
 * Blobデータからファイルをダウンロードさせる
 * @param {Blob} blob - ダウンロードするファイルデータ
 * @param {string} filename - ファイル名
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * モバイル環境でダウンロード選択肢を表示する
 * @param {Array<{filename: string, blob: Blob}>} files - ファイル情報の配列
 */
function displayDownloadLinks(files) {
    const downloadArea = document.getElementById('pdf-download-area');
    if (!downloadArea) {
        console.error("PDF download area element not found.");
        return; 
    }

    downloadArea.innerHTML = '<h4>ダウンロードするPDFを選択してください:</h4>';
    
    files.forEach(file => {
        const button = document.createElement('button');
        
        // ファイル名から種類を抽出して表示
        let buttonText = file.filename.includes('色反転') 
            ? 'シンプル (色反転)' 
            : file.filename.includes('シンプル') 
                ? 'シンプル (白背景)' 
                : '詳細バージョン';
        
        button.textContent = buttonText;
        button.className = 'download-option-button'; 
        // 簡易的なボタンCSSをインラインで設定
        button.style.cssText = 'margin: 5px; padding: 10px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;';

        button.onclick = () => {
            downloadBlob(file.blob, file.filename);
            // ダウンロード開始後、選択肢を非表示にする
            // downloadArea.style.display = 'none'; // ユーザーが他のファイルもダウンロードできるよう、敢えて残しておくのもあり
        };
        downloadArea.appendChild(button);
    });

    // 選択肢を表示
    downloadArea.style.display = 'block';
}



// =============================================================================
// Firebase連携と状態管理
// =============================================================================

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
    if (typeof firebase === 'undefined' || !firebase.database) {
        showMessage('Firebaseが初期化されていません。', 'error'); 
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    const currentState = getCurrentState();
    const setlistRef = database.ref('setlists').push();

    setlistRef.set(currentState)
        .then(() => {
            const shareId = setlistRef.key;
            const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

            // --- 共有テキストの生成ロジック (変更なし) ---
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
                if (songData.drumsoloChecked) titleText += ' 〜ドラムソロ〜';

                const isAlbum1 = songData.itemId && album1ItemIds.includes(songData.itemId);

                if (isAlbum1) {
                    songListText += `    ${titleText}\n`;
                } else {
                    songListText += `${shareableTextItemNo++}. ${titleText}\n`;
                }
            });
            shareText += songListText;
            // ------------------------------------------

            if (navigator.share) {
                // スマホ (Web Share API対応): ネイティブ共有ダイアログ
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
                // PC (Web Share API非対応): クリップボードへのコピーを修正
                const tempInput = document.createElement('textarea');
                // ★修正箇所: セットリスト内容と共有リンクを両方コピー
                tempInput.value = `${shareText}\n共有リンク: ${shareLink}`; 
                document.body.appendChild(tempInput);
                
                // textarea の内容を全選択し、コピーコマンドを実行
                tempInput.select();
                // 一部のブラウザでは select() の後に setSelectionRange() が必要
                tempInput.setSelectionRange(0, 99999); 
                
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
                    // maxSongs のループではなく、直接スロット要素を取得してクリア
                    document.querySelectorAll('#setlist .setlist-slot').forEach(slot => {
                        clearSlotContent(slot);
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
                            updateDays(); // 日付選択肢を更新
                            setlistDay.value = dateParts[2];
                            console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                        } else {
                            console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                        }
                    } else {
                        console.log("[loadSetlistState] No date to restore or date select elements not found.");
                        updateDatePickersToToday(); // デフォルトで今日の日付を設定
                    }
                    if (setlistVenue) {
                        setlistVenue.value = state.setlistVenue || '';
                        console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
                    }

                    // セットリストアイテムの復元
                    state.setlist.forEach(itemData => {
                        const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
                        if (targetSlot) {
                            // fillSlotWithItem を使用してデータをスロットに設定
                            fillSlotWithItem(targetSlot, itemData);
                            // ロード時にアルバムメニューの該当アイテムを隠す
                            // hideSetlistItemsInMenu() が後でまとめて処理するのでここでは不要
                            console.log(`[loadSetlistState] Filled slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                        } else {
                            console.warn(`[loadSetlistState] Target slot not found for index: ${itemData.slotIndex}`);
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
                    updateDatePickersToToday(); // デフォルトで今日の日付を設定
                    resolve();
                }
            })
            .catch((error) => {
                console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
                showMessage('セットリストのロードに失敗しました。', 'error');
                updateDatePickersToToday(); // エラー時も今日の日付を設定
                reject(error);
            });
    });
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
    // 文字順ビューが非表示の時のみアルバム切り替えを許可
    const nameOrderContainer = document.getElementById('nameOrderContainer');
    if (nameOrderContainer && !nameOrderContainer.classList.contains('hidden')) {
        return; 
    }

    document.querySelectorAll(".album-content").forEach(content => {
        if (content.id === "album" + albumIndex) {
            content.classList.toggle("active");
            console.log(`[toggleAlbum] Album ${albumIndex} is now: ${content.classList.contains('active') ? 'open' : 'closed'}`);
        } else {
            content.classList.remove("active");
        }
    });

    // アルバム切り替え時にも重複アイテムを隠す
    if (typeof hideSetlistItemsInMenu === 'function') {
        hideSetlistItemsInMenu();
    }
}

/**
 * 指定したモーダルを開き、bodyに'modal-open'クラスを追加する。
 * @param {string} modalId - 開くモーダルのID (例: 'pastSetlistsModal')
 */
function openModalWithBodyClass(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

/**
 * 指定したモーダルを閉じ、bodyから'modal-open'クラスを削除する。
 * @param {string} modalId - 閉じるモーダルのID
 */
function closeModalWithBodyClass(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
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
        updateDays(); // 月と年を設定した後で、日のドロップダウンを正しく生成
        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[updateDatePickersToToday] Set setlist date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[updateDatePickersToToday] Date select elements not fully found. Skipping auto-set date.");
    }
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
    checkbox.checked = isChecked; // ここで初期状態が正しく設定される
    checkbox.addEventListener('change', onChangeHandler);

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    return wrapper;
}

/**
 * 文字順ビューで特定のグループのコンテンツを表示する。
 * @param {HTMLElement} navItem - クリックされたナビゲーションアイテム。
 * @param {string} groupKey - 表示するグループのキー（例: 'ABCDE', 'AIUEO'）。
 */
function toggleNameOrderGroup(navItem, groupKey) {
    const contentToDisplay = document.getElementById(`name-group-${groupKey}`);
    const allContents = document.querySelectorAll('.name-order-group-content');
    const allNavItems = document.querySelectorAll('.name-order-nav-item');
    
    // すべてのコンテンツを非表示にし、ナビゲーションの active クラスを解除
    allContents.forEach(content => content.classList.add('hidden'));
    allNavItems.forEach(item => item.classList.remove('active'));
    
    // 選択されたコンテンツを表示し、ナビゲーションに active クラスを設定
    if (contentToDisplay) {
        contentToDisplay.classList.remove('hidden');
        navItem.classList.add('active');
        
        // コンテンツ表示後、重複アイテムを隠す関数を呼び出す
        if (typeof hideSetlistItemsInMenu === 'function') {
            hideSetlistItemsInMenu();
        }
    }
}


/**
 * セットリストスロットの内容を更新（曲名とオプションの表示）。
 * @param {HTMLElement} slotElement - 更新するセットリストスロット要素。
 * @param {string} songName - 表示する曲名。
 * @param {Object} options - 曲のオプション。 (optionsには specialEffect が含まれている必要があります)
 */
function updateSlotContent(slotElement, songName, options) {
    // 既存のコンテンツをクリア
    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }

    // song-info-container を作成
    const songInfoContainer = document.createElement('div');
    songInfoContainer.classList.add('song-info-container');

    // song-name-and-option を作成
    const songNameAndOption = document.createElement('div');
    songNameAndOption.classList.add('song-name-and-option');
    
    // --- 自由入力判定用フラグ ---
    const isCustom = slotElement.dataset.itemId === 'album1-custom';
    const isSeCustom = slotElement.dataset.itemId === 'album1-se-custom';

    if (isCustom || isSeCustom) {
        // IDに応じてデフォルト名とプレースホルダーを切り替え
        const defaultName = isSeCustom ? 'SE(自由入力)' : '自由入力曲';
        const placeholderText = isSeCustom ? 'SE名を入力' : '曲名を入力';

        // ★PDF文字化け対策：PDFライブラリが読み取るための隠しスパン★
        const pdfFriendlySpan = document.createElement('span');
        pdfFriendlySpan.classList.add('song-name');
        pdfFriendlySpan.textContent = songName || defaultName;
        pdfFriendlySpan.style.display = 'none'; // 画面には表示しない
        songNameAndOption.appendChild(pdfFriendlySpan);

        const customNameInput = document.createElement('input');
        customNameInput.type = 'text';
        customNameInput.classList.add('custom-song-input');
        customNameInput.placeholder = placeholderText;
        
        if (songName && songName !== defaultName) {
            customNameInput.value = songName;
        }
        
        customNameInput.addEventListener('input', (e) => {
            const newSongName = e.target.value.trim() || defaultName;
            slotElement.dataset.songName = newSongName; 
            pdfFriendlySpan.textContent = newSongName; // 裏側のスパンも同期更新
            console.log(`[custom-song-input] Song name updated to: ${slotElement.dataset.songName}`);
        });

        // ダブルクリックイベントが親要素に伝播するのを停止
        customNameInput.addEventListener('dblclick', (e) => {
            e.stopPropagation();
        });
        
        customNameInput.addEventListener('blur', () => {
            if (!customNameInput.value.trim()) {
                customNameInput.value = ''; // 入力が空の場合はplaceholderに戻す
            }
        });

        songNameAndOption.appendChild(customNameInput);
    } else {
        // 通常の曲の場合は、これまで通り<span>要素に曲名を表示
        const songNameSpan = document.createElement('span');
        songNameSpan.textContent = songName;
        songNameSpan.classList.add('song-name');
        songNameAndOption.appendChild(songNameSpan);
    }

    
    // オプション要素 (チェックボックスとプルダウン) をラップするコンテナ
    const itemOptions = document.createElement('div');
    itemOptions.classList.add('item-options');

    let hasAnyCheckboxOption = false;
    let hasCustomOptions = false; 
    
    // ★★★ 自由入力曲(album1-custom) の場合のみプルダウンを生成 ★★★
    if (isCustom) {
        hasCustomOptions = true; 

        const createCustomSelect = (datasetKey, optionsArray) => {
            const select = document.createElement('select');
            select.classList.add('custom-option-select');
            select.dataset.optionType = datasetKey;
            
            optionsArray.forEach(opt => {
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.label;
                select.appendChild(optionElement);
            });
            
            select.value = slotElement.dataset[datasetKey] || optionsArray[0].value;
            
            select.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                slotElement.dataset[datasetKey] = selectedValue;
                console.log(`[CustomSelectChange] ${datasetKey} updated to: ${selectedValue}`);
            });
            
            return select;
        };
        
        itemOptions.appendChild(createCustomSelect('rGt', customRGtTuningOptions));
        itemOptions.appendChild(createCustomSelect('lGt', customLGtTuningOptions));
        itemOptions.appendChild(createCustomSelect('bass', customBassTuningOptions));
        itemOptions.appendChild(createCustomSelect('bpm', customBpmOptions));
        itemOptions.appendChild(createCustomSelect('chorus', customChorusOptions));
    }
    
    // Short有無
    if (options.isShortVersion) { 
        hasAnyCheckboxOption = true;
        const shortVersionCheckboxWrapper = createCheckboxWrapper('Short', options.short, (e) => { 
            slotElement.dataset.short = e.target.checked.toString();
            slotElement.classList.toggle('short', e.target.checked);
        });
        shortVersionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'short';
        itemOptions.appendChild(shortVersionCheckboxWrapper);
    }

    // SE有無
    if (options.hasSeOption) { 
        hasAnyCheckboxOption = true;
        const seOptionCheckboxWrapper = createCheckboxWrapper('SE有り', options.seChecked, (e) => { 
            slotElement.dataset.seChecked = e.target.checked.toString();
            slotElement.classList.toggle('se-active', e.target.checked);
        });
        seOptionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'se';
        itemOptions.appendChild(seOptionCheckboxWrapper);
    }

    // ドラムソロ有無
    if (options.drumsoloOption) { 
        hasAnyCheckboxOption = true;
        const drumsoloOptionCheckboxWrapper = createCheckboxWrapper('ドラムソロ有り', options.drumsoloChecked, (e) => { 
            slotElement.dataset.drumsoloChecked = e.target.checked.toString();
            slotElement.classList.toggle('drumsolo-active', e.target.checked);
        });
        drumsoloOptionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'drumsolo';
        itemOptions.appendChild(drumsoloOptionCheckboxWrapper);
    }
    
    // 特効プルダウン
    const currentItemId = slotElement.dataset.itemId;
    const isSpecialEffectExcluded = (typeof specialEffectExclusionList !== 'undefined') && specialEffectExclusionList.includes(currentItemId);
    
    if (typeof specialEffectOptions !== 'undefined' && !isSpecialEffectExcluded) {
        const specialEffectWrapper = document.createElement('div');
        specialEffectWrapper.classList.add('special-effect-wrapper');
        
        const specialEffectSelect = document.createElement('select');
        specialEffectSelect.classList.add('special-effect-select');
        
        specialEffectOptions.forEach(opt => {
            const optionElement = document.createElement('option');
            optionElement.value = opt.value;
            optionElement.textContent = opt.label;
            specialEffectSelect.appendChild(optionElement);
        });
        
        specialEffectSelect.value = options.specialEffect || ''; 
        
        specialEffectSelect.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            slotElement.dataset.specialEffect = selectedValue;
            slotElement.classList.forEach(cls => {
                if (cls.startsWith('fx-')) slotElement.classList.remove(cls);
            });
            if (selectedValue) slotElement.classList.add(`fx-${selectedValue}`);
        });
        
        specialEffectWrapper.appendChild(specialEffectSelect);
        itemOptions.appendChild(specialEffectWrapper);
    }

    if (hasAnyCheckboxOption || hasCustomOptions || (typeof specialEffectOptions !== 'undefined' && !isSpecialEffectExcluded)) {
        songNameAndOption.appendChild(itemOptions);
    }

    songInfoContainer.appendChild(songNameAndOption);

    // --- Additional Song Info (SE自由入力の場合は何も表示しない) ---
    if (!isSeCustom) {
        const additionalInfoDiv = document.createElement('div');
        additionalInfoDiv.classList.add('additional-song-info');
        
        let infoParts = [];
        
        if (options.rGt && options.rGt !== customRGtTuningOptions[0].value) infoParts.push(`R.Gt: ${options.rGt}`);
        if (options.lGt && options.lGt !== customLGtTuningOptions[0].value) infoParts.push(`L.Gt: ${options.lGt}`);
        if (options.bass && options.bass !== customBassTuningOptions[0].value) infoParts.push(`Ba: ${options.bass}`);
        if (options.bpm && options.bpm !== customBpmOptions[0].value) infoParts.push(`BPM: ${options.bpm}`);
        if (options.chorus && options.chorus !== customChorusOptions[0].value && options.chorus !== 'false') infoParts.push(`コーラス: ${options.chorus}`); 

        if (infoParts.length > 0) {
            additionalInfoDiv.textContent = infoParts.join(' | ');
            songInfoContainer.appendChild(additionalInfoDiv);
        }
    }

    slotElement.appendChild(songInfoContainer);

    const dragHandle = document.createElement('span');
    dragHandle.classList.add('drag-handle');
    dragHandle.textContent = '☰';
    slotElement.appendChild(dragHandle);
}


/**
 * セットリストの指定されたスロットに曲を追加する。
 * @param {HTMLElement} slotElement - 曲を追加するセットリストのスロット要素。
 * @param {string} itemId - 曲のユニークなID。
 * @param {string} songName - 曲名。
 * @param {Object} options - 曲のオプション。 (optionsには specialEffect が含まれている必要があります)
 * @param {string} albumClass - 曲が属するアルバムのクラス名 (例: 'album1', 'album2'。
 */
function addSongToSlot(slotElement, itemId, songName, options, albumClass) {
    console.log(`[addSongToSlot] Adding song ${songName} (${itemId}) to slot ${slotElement.dataset.slotIndex}. Album: ${albumClass}`);
    console.log(`[addSongToSlot] Options received:`, options);

    // スロットの内容をクリア
    clearSlotContent(slotElement);

    // 新しい曲要素のデータ属性を設定
    slotElement.dataset.itemId = itemId;
    slotElement.dataset.songName = songName;
    
    // オプションが「存在しうるか」を示すデータ属性 (dataset.isShortVersionなど)
    // ここで Boolean 値を文字列 'true' / 'false' に変換して保存
    slotElement.dataset.isShortVersion = options.isShortVersion ? 'true' : 'false';
    slotElement.dataset.hasSeOption = options.hasSeOption ? 'true' : 'false';
    
    // ★★★ 修正箇所：データ属性名を data-drumsolo-option に変更 ★★★
    // HTMLの属性名 (data-has-drumsolo-option) とは違う名前 (data-drumsolo-option) で保存することで、
    // チェックボックス表示ロジック（updateSlotContentなど）が期待する属性名に合わせる
    slotElement.dataset.drumsoloOption = options.drumsoloOption ? 'true' : 'false'; 

    // チューニングやBPMは文字列としてそのまま保存
    slotElement.dataset.rGt = options.rGt || ''; 
    slotElement.dataset.lGt = options.lGt || '';
    slotElement.dataset.bass = options.bass || '';
    slotElement.dataset.bpm = options.bpm || '';
    slotElement.dataset.chorus = options.chorus || 'false'; 
    
    // ★★★ 追加：特効の選択状態をデータ属性に保存 ★★★
    // ロード/移動時は options の値、アルバムからの追加時（options.specialEffectが未定義）は初期値の '' を使用
    slotElement.dataset.specialEffect = options.specialEffect || ''; 

    // チェックボックスの現在の状態を示すデータ属性
    slotElement.dataset.short = options.short ? 'true' : 'false';
    slotElement.dataset.seChecked = options.seChecked ? 'true' : 'false';
    slotElement.dataset.drumsoloChecked = options.drumsoloChecked ? 'true' : 'false';

    // クラスを追加してスタイルを適用
    slotElement.classList.add('setlist-item', 'item', albumClass);
    
    // チェックボックスの初期状態に応じてクラスも設定
    slotElement.classList.toggle('short', options.short);
    slotElement.classList.toggle('se-active', options.seChecked);
    slotElement.classList.toggle('drumsolo-active', options.drumsoloChecked);
    
    // ★★★ 追加：特効の初期状態に応じてクラスも設定 ★★★
    const currentEffect = slotElement.dataset.specialEffect;
    if (currentEffect) {
        slotElement.classList.add(`fx-${currentEffect}`);
    }

    // スロットの pointer-events を 'auto' に設定（これでタップ・ドラッグ可能になる）
    slotElement.style.pointerEvents = 'auto';
    slotElement.style.touchAction = 'pan-y'; // タッチスクロールを許可

    // スロットのコンテンツを更新（曲名やオプションの表示）
    // updateSlotContent には options オブジェクトをそのまま渡す
    updateSlotContent(slotElement, songName, options);

    // イベントリスナーの再設定 (コンテンツが更新されたスロットに対して)
    enableDragAndDrop(slotElement);

    console.log(`[addSongToSlot] Successfully added song ${songName} to slot ${slotElement.dataset.slotIndex}.`);
}




/**
 * セットリストの指定されたスロットに曲を追加する。
 * @param {HTMLElement} slotElement - 曲を追加するセットリストのスロット要素。
 * @param {string} itemId - 曲のユニークなID。
 * @param {string} songName - 曲名。
 * @param {Object} options - 曲のオプション。 (optionsには specialEffect が含まれている必要があります)
 * @param {string} albumClass - 曲が属するアルバムのクラス名 (例: 'album1', 'album2'。
 */
function addSongToSlot(slotElement, itemId, songName, options, albumClass) {
    console.log(`[addSongToSlot] Adding song ${songName} (${itemId}) to slot ${slotElement.dataset.slotIndex}. Album: ${albumClass}`);
    console.log(`[addSongToSlot] Options received:`, options);

    // スロットの内容をクリア
    clearSlotContent(slotElement);

    // 新しい曲要素のデータ属性を設定
    slotElement.dataset.itemId = itemId;
    slotElement.dataset.songName = songName;
    
    // オプションが「存在しうるか」を示すデータ属性 (dataset.isShortVersionなど)
    // ここで Boolean 値を文字列 'true' / 'false' に変換して保存
    slotElement.dataset.isShortVersion = options.isShortVersion ? 'true' : 'false';
    slotElement.dataset.hasSeOption = options.hasSeOption ? 'true' : 'false';
    
    // ★★★ 修正箇所：データ属性名を data-drumsolo-option に変更 ★★★
    // HTMLの属性名 (data-has-drumsolo-option) とは違う名前 (data-drumsolo-option) で保存することで、
    // チェックボックス表示ロジック（updateSlotContentなど）が期待する属性名に合わせる
    slotElement.dataset.drumsoloOption = options.drumsoloOption ? 'true' : 'false'; 

    // チューニングやBPMは文字列としてそのまま保存
    slotElement.dataset.rGt = options.rGt || ''; 
    slotElement.dataset.lGt = options.lGt || '';
    slotElement.dataset.bass = options.bass || '';
    slotElement.dataset.bpm = options.bpm || '';
    slotElement.dataset.chorus = options.chorus || 'false'; 
    
    // ★★★ 追加：特効の選択状態をデータ属性に保存 ★★★
    // ロード/移動時は options の値、アルバムからの追加時（options.specialEffectが未定義）は初期値の '' を使用
    slotElement.dataset.specialEffect = options.specialEffect || ''; 

    // チェックボックスの現在の状態を示すデータ属性
    slotElement.dataset.short = options.short ? 'true' : 'false';
    slotElement.dataset.seChecked = options.seChecked ? 'true' : 'false';
    slotElement.dataset.drumsoloChecked = options.drumsoloChecked ? 'true' : 'false';

    // クラスを追加してスタイルを適用
    slotElement.classList.add('setlist-item', 'item', albumClass);
    
    // チェックボックスの初期状態に応じてクラスも設定
    slotElement.classList.toggle('short', options.short);
    slotElement.classList.toggle('se-active', options.seChecked);
    slotElement.classList.toggle('drumsolo-active', options.drumsoloChecked);
    
    // ★★★ 追加：特効の初期状態に応じてクラスも設定 ★★★
    const currentEffect = slotElement.dataset.specialEffect;
    if (currentEffect) {
        slotElement.classList.add(`fx-${currentEffect}`);
    }

    // スロットの pointer-events を 'auto' に設定（これでタップ・ドラッグ可能になる）
    slotElement.style.pointerEvents = 'auto';
    slotElement.style.touchAction = 'pan-y'; // タッチスクロールを許可

    // スロットのコンテンツを更新（曲名やオプションの表示）
    // updateSlotContent には options オブジェクトをそのまま渡す
    updateSlotContent(slotElement, songName, options);

    // イベントリスナーの再設定 (コンテンツが更新されたスロットに対して)
    enableDragAndDrop(slotElement);

    console.log(`[addSongToSlot] Successfully added song ${songName} to slot ${slotElement.dataset.slotIndex}.`);
}



// =============================================================================
// ★★★ 文字順ソート機能の追加 (絶妙なバランスを保つための新規追加ブロック) ★★★
// =============================================================================

// グローバルまたは適切なスコープで定義 (既存のグローバル変数と衝突しないように注意)
let allSongData = []; 
let nameOrderGroups = {};
let isBuildingList = false; // ★追加: リスト構築中フラグ★

/**
 * アルバム順と文字順の表示を切り替える
 */
function changeAlbumView() {
    const sortSelect = document.getElementById('sortOrder');
    
    // アルバムタブ全体の親要素 (<ul class="album-list">) を取得
    const albumList = document.querySelector('.album-list'); 
    
    // アルバムコンテンツの親要素
    const albumViewContainer = document.getElementById('albumViewContainer'); 
    
    // 文字順リストの親
    const nameOrderContainer = document.getElementById('nameOrderContainer'); 

    // 移動対象：過去セットリストボタンのコンテナ (HTMLに <div id="pastSetlistsButtonContainer"> があると仮定)
    const pastSetlistsButtonContainer = document.getElementById('pastSetlistsButtonContainer'); 
    
    // 移動先基準：文字順リスト全体をラップしている要素 (通常 #nameOrderContainer)
    // 過去セットリストボタンを #nameOrderContainer の直後に配置するため、親を取得
    const nameOrderViewParent = nameOrderContainer ? nameOrderContainer.parentNode : null;
    
    // アルバム順ビューでの元の親要素 (過去セットリストボタンの初期位置)
    // HTML上で #menu の直下に <div id="menuFooter"> があると仮定
    const originalParent = document.getElementById('menuFooter'); 
    
    const mode = sortSelect.value;
    
    // 現在開いているアルバムセクションをすべて閉じる (album-content)
    document.querySelectorAll('.album-content.active').forEach(content => {
        content.classList.remove('active');
    });

    if (mode === 'name_order') {
        // 現在、アルバム順ビューがアクティブ -> 文字順ビューに切り替える

        if (isBuildingList) return; 
        isBuildingList = true; // 構築開始フラグを設定

        document.querySelectorAll('.name-order-nav-item').forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.5'; // ユーザーに処理中であることを示唆
        });

        // 💡 修正点 1: アルバムリストを非表示にする
        if (albumList) albumList.classList.add('hidden'); // CSSで非表示にするクラスを付与
        albumViewContainer.classList.add('hidden');
        nameOrderContainer.classList.remove('hidden');
        
        // 文字順リストを構築・表示
        if (typeof buildNameOrderList === 'function') {
            buildNameOrderList();
        }

        // 💡 修正点 2: 過去セットリストボタンを文字順リストの直下に移動
        if (pastSetlistsButtonContainer && nameOrderViewParent && nameOrderContainer) {
            // #nameOrderContainer の親要素の中に、#nameOrderContainer の直後の兄弟として挿入
            nameOrderViewParent.insertBefore(pastSetlistsButtonContainer, nameOrderContainer.nextSibling);
            
            // 必要に応じて文字順用のスタイルを適用
            // このクラスは、過去セットリストボタンの幅調整などに使われます
            pastSetlistsButtonContainer.classList.add('name-order-footer-style'); 
            console.log("[changeAlbumView] Past setlists button moved below name order view.");
        }

    } else if (mode === 'album') {
        // 現在、文字順ビューがアクティブ -> アルバム順ビューに戻す

        isBuildingList = false;
        document.querySelectorAll('.name-order-nav-item').forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });
        
        nameOrderContainer.classList.add('hidden');
        
        // 💡 修正点 3: アルバムリストを表示に戻す
        if (albumList) albumList.classList.remove('hidden');
        albumViewContainer.classList.remove('hidden');
        
        // 💡 修正点 4: 過去セットリストボタンを元の親要素に戻す
        if (pastSetlistsButtonContainer && originalParent) {
            // 元の親要素（#menuFooter）の末尾にボタンのコンテナを戻す
            originalParent.appendChild(pastSetlistsButtonContainer);
            
            // 文字順用のスタイルを削除
            pastSetlistsButtonContainer.classList.remove('name-order-footer-style'); 
            console.log("[changeAlbumView] Past setlists button returned to original parent.");
        }

        // アルバム順に戻したとき、最初のアルバムを開く
        const firstAlbumNavButton = document.querySelector('.album-list li[onclick^="toggleAlbum"]');
        if (firstAlbumNavButton) {
             const albumIndexMatch = firstAlbumNavButton.getAttribute('onclick').match(/toggleAlbum\((\d+)\)/);
             if (albumIndexMatch && typeof toggleAlbum === 'function') {
                // toggleAlbum 関数が存在し、引数を取得できた場合のみ実行
                toggleAlbum(parseInt(albumIndexMatch[1]));
             }
        } else {
            const album1 = document.getElementById('album1'); 
            if (album1) album1.classList.add('active');
        }
    }
}

/**
 * すべてのアルバムから曲データを収集し、文字順でソートしてグルーピングする。
 */
function buildNameOrderList() {
    console.log("[buildNameOrderList] Starting list construction.");
    
    const nameOrderContent = document.getElementById('nameOrderContent');
    const nameOrderNav = document.getElementById('nameOrderNav'); 
    
    if (!nameOrderContent || !nameOrderNav) {
        isBuildingList = false; // エラー時もフラグをリセット
        return; 
    }

    // ★★★ データの再収集と初期化を強制的に行う ★★★
    allSongData = []; // データをリセット
    nameOrderGroups = {}; // グループをリセット
        
    // --- 1. すべての曲データを収集 ---
    document.querySelectorAll('.album-content .item').forEach(item => { 
        
        // 自由入力曲のプレースホルダーをスキップ
        if (item.dataset.itemId === 'album1-custom') return; 
        
        // データの抽出 (元のコードブロックの内容)
        const itemId = item.dataset.itemId;
        const songName = item.dataset.songName;
        // albumClass は 'album1', 'album2' などのクラスを取得
        const albumClass = Array.from(item.classList).find(cls => cls.startsWith('album'));
        
        if (itemId && songName) {
            const data = {
                itemId: itemId,
                songName: songName,
                albumClass: albumClass || 'album-unknown',
                isShortVersion: item.dataset.isShortVersion === 'true',
                hasSeOption: item.dataset.hasSeOption === 'true',
                drumsoloOption: item.dataset.drumsoloOption === 'true',
                rGt: item.dataset.rGt || '', 
                lGt: item.dataset.lGt || '',
                bass: item.dataset.bass || '',
                bpm: item.dataset.bpm || '',
                chorus: item.dataset.chorus || 'false',
                short: item.dataset.short === 'true',
                seChecked: item.dataset.seChecked === 'true',
                drumsoloChecked: item.dataset.drumsoloChecked === 'true',
                // ソートキーのデータを収集
                alphaSort: item.dataset.alphaSort || '',
                kanaSort: item.dataset.kanaSort || '',
            };
            allSongData.push(data);
        }
    });
    // --- 2. 曲名でソート (ソートキーに基づいて修正) ---
    allSongData.sort((a, b) => {
        // ソートキーの決定: alphaSort > kanaSort > songName の優先順位
        const keyA = (a.alphaSort || a.kanaSort || a.songName).toUpperCase();
        const keyB = (b.alphaSort || b.kanaSort || b.songName).toUpperCase();
        
        // 日本語環境で正確に比較
        return keyA.localeCompare(keyB, 'ja', { sensitivity: 'base' });
    });

    // --- 3. グループに分割 ---
    nameOrderGroups = groupSongs(allSongData);
    
    // --- 4. コンテンツの構築 ---
    // コンテンツを描画
    clearAndDrawNameOrderList();
    
    // 構築が完了したら、ナビゲーションを有効に戻す
    document.querySelectorAll('.name-order-nav-item').forEach(item => {
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
    });
    isBuildingList = false; // 構築終了フラグ

    // ★★★ 削除: 初期状態で曲がある最初のグループを開くロジックをすべて削除 ★★★
    /*
    const allNavItems = document.querySelectorAll('.name-order-nav-item');
    let firstNonEmptyGroupNav = null;

    for (const navItem of allNavItems) {
        const groupKey = navItem.dataset.group;
        if (nameOrderGroups[groupKey] && nameOrderGroups[groupKey].length > 0) {
            firstNonEmptyGroupNav = navItem;
            break; 
        }
    }

    if (firstNonEmptyGroupNav) {
        toggleNameOrderGroup(firstNonEmptyGroupNav, firstNonEmptyGroupNav.dataset.group);
        console.log(`[buildNameOrderList] Initial group opened: ${firstNonEmptyGroupNav.dataset.group}`);
    } else {
        console.warn("[buildNameOrderList] No songs found in any group. List will be empty.");
    }
    */

    // ★★★ 修正: 代わりに、曲データがない場合の警告のみ残します ★★★
    if (allSongData.length === 0) {
        console.warn("[buildNameOrderList] No songs found in any group. List will be empty.");
    }

    console.log(`[buildNameOrderList] Total songs collected: ${allSongData.length}`);
}



/**
 * グループ化された曲データに基づいて、文字順リストのDOMを構築・描画する。
 */
function clearAndDrawNameOrderList() {
    console.log("[clearAndDrawNameOrderList] Drawing name order list content.");
    const nameOrderContent = document.getElementById('nameOrderContent');
    if (!nameOrderContent || typeof nameOrderGroups === 'undefined') {
        console.error("Error: #nameOrderContent or nameOrderGroups is missing.");
        return;
    }
    
    // 既存のコンテンツを全てクリア
    nameOrderContent.innerHTML = ''; 

    // グループごとのコンテンツを描画
    for (const groupKey in nameOrderGroups) {
        const songs = nameOrderGroups[groupKey];
        
        // 曲がないグループはスキップ (意図的にDOM生成しない)
        if (songs.length === 0) continue; 

        // 1. グループコンテナを作成
        const groupContainer = document.createElement('div');
        groupContainer.id = `name-group-${groupKey}`;
        // 初期状態では非表示にする
        groupContainer.classList.add('name-order-group-content', 'hidden'); 

        const ul = document.createElement('ul');
        ul.classList.add('album-content-list');
        
        // 2. グループ内の曲をリストアイテムとして追加
        songs.forEach(songData => {
            const itemElement = createAlbumItemElement(songData);
            ul.appendChild(itemElement);
            
            // 生成したアイテムにD&Dイベントを登録
            enableDragAndDrop(itemElement); 
        });

        groupContainer.appendChild(ul);
        nameOrderContent.appendChild(groupContainer);
        console.log(`[clearAndDrawNameOrderList] Drawn group: ${groupKey} with ${songs.length} songs.`);
    }
}


/**
 * ひらがなまたはカタカナの文字を受け取り、対応する清音（濁点・半濁点のない文字）を返す。
 * @param {string} char - 濁音または半濁音を含む可能性のある文字。
 * @returns {string} 対応する清音。
 */
function getSeion(char) {
    // 濁音・半濁音と清音のマッピング
    const seionMap = {
        'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
        'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
        'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
        'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
        'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ',
        
        'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
        'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
        'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
        'バ': 'ハ', 'ビ': 'ヒ', 'ブ': 'フ', 'ベ': 'ヘ', 'ボ': 'ホ',
        'パ': 'ハ', 'ピ': 'ヒ', 'プ': 'フ', 'ペ': 'ヘ', 'ポ': 'ホ',
        // 拗音（ゃゅょ）や促音（っ）など、他の特殊な文字はそのまま返すか、
        // 既存のAIUEOフォールバックに任せる
    };
    // マッピングにあれば清音を返し、なければ元の文字をそのまま返す
    return seionMap[char] || char; 
}


/**
 * 曲データのソートキーに基づいてグループに分類する。
 */
function groupSongs(songs) {
    const groups = {
        'ABCDE': [], 'FGHIJ': [], 'KLMNO': [], 'PQRST': [], 'UVWXYZ': [],
        'AIUEO': [], 'KAKIKUKEO': [], 'SASISHISO': [], 'TATITUTETO': [], 'NANINUNENO': [],
        'HAHIHUHEHO': [], 'MAMIMUMEMO': [], 'YAYUYO': [], 'RARIRURERO': [], 'WAWOUN': [],
        'ETC_NONE': []
    };

    // 日本語の頭文字変換のためのマッピング (ひらがなとカタカナに対応)
    const japaneseMap = {
        // あ行 (AIUEO)
        'ア': 'AIUEO', 'イ': 'AIUEO', 'ウ': 'AIUEO', 'エ': 'AIUEO', 'オ': 'AIUEO',
        'あ': 'AIUEO', 'い': 'AIUEO', 'う': 'AIUEO', 'え': 'AIUEO', 'お': 'AIUEO',
        
        // か行 (KAKIKUKEO)
        'カ': 'KAKIKUKEO', 'キ': 'KAKIKUKEO', 'ク': 'KAKIKUKEO', 'ケ': 'KAKIKUKEO', 'コ': 'KAKIKUKEO',
        'か': 'KAKIKUKEO', 'き': 'KAKIKUKEO', 'く': 'KAKIKUKEO', 'け': 'KAKIKUKEO', 'こ': 'KAKIKUKEO',
        
        // さ行 (SASISHISO)
        'サ': 'SASISHISO', 'シ': 'SASISHISO', 'ス': 'SASISHISO', 'セ': 'SASISHISO', 'ソ': 'SASISHISO',
        'さ': 'SASISHISO', 'し': 'SASISHISO', 'す': 'SASISHISO', 'せ': 'SASISHISO', 'そ': 'SASISHISO',
        
        // た行 (TATITUTETO)
        'タ': 'TATITUTETO', 'チ': 'TATITUTETO', 'ツ': 'TATITUTETO', 'テ': 'TATITUTETO', 'ト': 'TATITUTETO',
        'た': 'TATITUTETO', 'ち': 'TATITUTETO', 'つ': 'TATITUTETO', 'て': 'TATITUTETO', 'と': 'TATITUTETO',
        
        // な行 (NANINUNENO)
        'ナ': 'NANINUNENO', 'ニ': 'NANINUNENO', 'ヌ': 'NANINUNENO', 'ネ': 'NANINUNENO', 'ノ': 'NANINUNENO',
        'な': 'NANINUNENO', 'に': 'NANINUNENO', 'ぬ': 'NANINUNENO', 'ね': 'NANINUNENO', 'の': 'NANINUNENO',
        
        // は行 (HAHIHUHEHO)
        'ハ': 'HAHIHUHEHO', 'ヒ': 'HAHIHUHEHO', 'フ': 'HAHIHUHEHO', 'ヘ': 'HAHIHUHEHO', 'ホ': 'HAHIHUHEHO',
        'は': 'HAHIHUHEHO', 'ひ': 'HAHIHUHEHO', 'ふ': 'HAHIHUHEHO', 'へ': 'HAHIHUHEHO', 'ほ': 'HAHIHUHEHO',
        
        // ま行 (MAMIMUMEMO)
        'マ': 'MAMIMUMEMO', 'ミ': 'MAMIMUMEMO', 'ム': 'MAMIMUMEMO', 'メ': 'MAMIMUMEMO', 'モ': 'MAMIMUMEMO',
        'ま': 'MAMIMUMEMO', 'み': 'MAMIMUMEMO', 'む': 'MAMIMUMEMO', 'め': 'MAMIMUMEMO', 'も': 'MAMIMUMEMO',
        
        // や行 (YAYUYO)
        'ヤ': 'YAYUYO', 'ユ': 'YAYUYO', 'ヨ': 'YAYUYO',
        'や': 'YAYUYO', 'ゆ': 'YAYUYO', 'よ': 'YAYUYO',
        
        // ら行 (RARIRURERO)
        'ラ': 'RARIRURERO', 'リ': 'RARIRURERO', 'ル': 'RARIRURERO', 'レ': 'RARIRURERO', 'ロ': 'RARIRURERO',
        'ら': 'RARIRURERO', 'り': 'RARIRURERO', 'る': 'RARIRURERO', 'れ': 'RARIRURERO', 'ろ': 'RARIRURERO',
        
        // わ行 (WAWOUN)
        'ワ': 'WAWOUN', 'ヲ': 'WAWOUN', 'ン': 'WAWOUN',
        'わ': 'WAWOUN', 'を': 'WAWOUN', 'ん': 'WAWOUN',
    };
    
    songs.forEach(song => {
        let firstChar = ''; 
        let groupKey = 'ETC_NONE';

        // 1. ソートキーの決定
        if (song.alphaSort) {
            firstChar = song.alphaSort.trim().charAt(0).toUpperCase();
        } else if (song.kanaSort) {
            firstChar = song.kanaSort.trim().charAt(0);
        } else {
            firstChar = song.songName.trim().charAt(0).toUpperCase(); 
        }

        // --- 分類ロジック ---
        
        // A. 英字の分類
        if (/[A-E]/.test(firstChar)) groupKey = 'ABCDE';
        else if (/[F-J]/.test(firstChar)) groupKey = 'FGHIJ';
        else if (/[K-O]/.test(firstChar)) groupKey = 'KLMNO';
        else if (/[P-T]/.test(firstChar)) groupKey = 'PQRST';
        else if (/[U-Z]/.test(firstChar)) groupKey = 'UVWXYZ';
        
        // B. 日本語の分類 (ひらがな・カタカナ)
        else if (song.kanaSort) {
            let jpChar = song.kanaSort.trim().charAt(0);
            
            // ★★★ 修正箇所: 分類前に清音化する ★★★
            const seionChar = getSeion(jpChar);
            
            // 清音（または清音化した文字）に基づいてマッピングからグループキーを取得
            const mappedGroup = japaneseMap[seionChar];
            
            if (mappedGroup) {
                groupKey = mappedGroup;
            } else if (/[ぁ-んァ-ヶ]/.test(jpChar)) { 
                // マッピングにないひらがな・カタカナ（主に拗音など）はAIUEOにフォールバック
                groupKey = 'AIUEO';
            } else {
                // kanaSortがあるが、それが漢字や記号だった場合（稀）
                groupKey = 'ETC_NONE';
            }
        }
        
        // C. 数字・記号・フォールバック (英字・日本語以外)
        else {
            // 英字・日本語ソートキーがなく、初文字が数字または記号の場合
            if (/[0-9\W]/.test(firstChar)) {
                groupKey = 'ETC_NONE';
            } else {
                // 上記のどの分類にも該当しない文字（主に漢字など）
                groupKey = 'AIUEO'; 
            }
        }
        
        // データを対応するグループに追加
        groups[groupKey].push(song);
    });

    return groups;
}


/**
 * 曲データオブジェクトから、アルバムリストで表示するアイテム要素を作成する。（省略）
 */
function createAlbumItemElement(songData) {
    const li = document.createElement('li');
    li.classList.add('item', songData.albumClass);
    li.draggable = true;
    
    // 全てのデータ属性を設定 (D&Dの際に必要)
    li.dataset.itemId = songData.itemId;
    li.dataset.songName = songData.songName;
    li.dataset.isShortVersion = songData.isShortVersion ? 'true' : 'false';
    li.dataset.hasSeOption = songData.hasSeOption ? 'true' : 'false';
    li.dataset.drumsoloOption = songData.drumsoloOption ? 'true' : 'false';
    li.dataset.rGt = songData.rGt || '';
    li.dataset.lGt = songData.lGt || '';
    li.dataset.bass = songData.bass || '';
    li.dataset.bpm = songData.bpm || '';
    li.dataset.chorus = songData.chorus || 'false';
    // 文字順リストではチェック状態は無視されますが、一応データとして保持
    li.dataset.short = songData.short ? 'true' : 'false';
    li.dataset.seChecked = songData.seChecked ? 'true' : 'false';
    li.dataset.drumsoloChecked = songData.drumsoloChecked ? 'true' : 'false';
    // ソートキーのデータ属性も設定
    li.dataset.alphaSort = songData.alphaSort || '';
    li.dataset.kanaSort = songData.kanaSort || '';

    // UIコンテンツの作成
    const songNameSpan = document.createElement('span');
    songNameSpan.classList.add('song-name');
    songNameSpan.textContent = songData.songName;
    li.appendChild(songNameSpan);
    
    return li;
}

/**
 * 文字順ビューで特定のグループのコンテンツを表示/非表示（トグル）する。
 * @param {HTMLElement} navItem - クリックされたナビゲーションアイテム。
 * @param {string} groupKey - 表示するグループのキー（例: 'ABCDE', 'AIUEO'）。
 */
function toggleNameOrderGroup(navItem, groupKey) {
    console.log(`[TOGGLE DEBUG] Clicked group: ${groupKey}`); 

    const contentToDisplay = document.getElementById(`name-group-${groupKey}`);
    const allContents = document.querySelectorAll('.name-order-group-content');
    const allNavItems = document.querySelectorAll('.name-order-nav-item');
    const nameOrderContentContainer = document.getElementById('nameOrderContent'); 

    if (!contentToDisplay) {
        console.warn(`[TOGGLE WARNING] Content element #name-group-${groupKey} not found! (これはそのグループに曲がない場合に予期されます)`); 
    }

    // ★★★ 修正箇所: 既にアクティブかどうかをチェック ★★★
    const alreadyActive = navItem.classList.contains('active');

    // 1. すべてのナビゲーションの状態をリセット
    allNavItems.forEach(item => item.classList.remove('active'));

    // 2. すべてのコンテンツを非表示にし、元の親要素（#nameOrderContent）に戻す
    allContents.forEach(content => {
        // 現在、タブの直下に挿入されているかもしれない要素を元に戻す
        if (content.parentNode !== nameOrderContentContainer) {
            nameOrderContentContainer.appendChild(content); 
        }
        // 非表示にする
        content.classList.add('hidden');
        content.style.display = 'none'; 
    });
    
    // 3. トグルロジックを実行
    if (alreadyActive) {
        // ★★★ 既にアクティブだった場合: 閉じる（ナビとコンテンツは既にリセット済み） ★★★
        console.log(`[TOGGLE DEBUG] Toggling off: ${groupKey}`);
        // 何も表示しないので、ここでは処理を終了する
        
    } else if (contentToDisplay) {
        // ★★★ アクティブではなかった場合: 開く ★★★
        
        // ナビゲーションをアクティブにする
        navItem.classList.add('active'); 

        // クリックされたナビゲーション項目の直後にコンテンツを挿入する
        navItem.parentNode.insertBefore(contentToDisplay, navItem.nextSibling);

        // コンテンツを表示する
        contentToDisplay.classList.remove('hidden');
        contentToDisplay.style.display = 'block'; 
        
        // 4. コンテンツ表示後、重複アイテムを隠す関数を呼び出す
        if (typeof hideSetlistItemsInMenu === 'function') {
            hideSetlistItemsInMenu();
        }
        console.log(`[TOGGLE DEBUG] Displaying: #name-group-${groupKey} (Moved below nav item)`);
    } else {
        // コンテンツがない場合: 何も表示しない
        console.log(`[TOGGLE DEBUG] Group ${groupKey} is empty, no content to display.`);
    }
}


// =============================================================================
// イベントリスナーの登録と初期化 (最終修正版)
// =============================================================================

/**
 * ドラッグ＆ドロップとダブルクリックを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
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

    if (element.classList.contains('item') || element.classList.contains('setlist-item')) {
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) {
            const songNameElement = element.querySelector('.song-name') || element; 
            element.dataset.songName = songNameElement.textContent.trim();
        }
        element.draggable = true;

        element.addEventListener("dragstart", handleDragStart);
        
        // ★★★ 修正: すべてのタッチイベントに { passive: false } を適用 ★★★
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd, { passive: false }); // 適用
        element.addEventListener("touchcancel", handleTouchEnd, { passive: false }); // 適用
        
        element.addEventListener("dblclick", handleDoubleClick);
    }

    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
    }
}



// ページロード時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application.");

    // ★★★ 修正: ローカル変数ではなく、グローバルスコープの setlist 変数に代入 ★★★
    // (setlistがlet setlist = null;として定義されている前提)
    setlist = document.getElementById('setlist'); 
    
    if (!setlist) {
        console.error("Error: #setlist element not found. Drag and drop functionality may be impaired.");
    }


    // --- ドラッグ＆ドロップ関連の初期設定 ---
    document.querySelectorAll(".album-content .item").forEach(item => {
        enableDragAndDrop(item);
    });

    // setlistがnullでないことを確認してから処理を進める
    if (setlist) {
        setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
            if (!slot.dataset.slotIndex) {
                slot.dataset.slotIndex = index.toString();
            }
            enableDragAndDrop(slot);
        });
    } 
    
    // Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
    document.addEventListener("dragend", finishDragging);


    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay'); // 追加: 初期設定で使用するため

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


    // --- モーダル関連の初期設定 (変更なし) ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton');
    // 2026年
    const open2026FromPastModalButton = document.getElementById('open2026FromPastModalButton');
    const year2026DetailModal = document.getElementById('year2026DetailModal');
    const close2026DetailModalButton = document.getElementById('close2026DetailModalButton');
    // 2025年
    const open2025FromPastModalButton = document.getElementById('open2025FromPastModalButton');
    const year2025DetailModal = document.getElementById('year2025DetailModal');
    const close2025DetailModalButton = document.getElementById('close2025DetailModalButton');
    // 2024年
    const open2024FromPastModalButton = document.getElementById('open2024FromPastModalButton');
    const year2024DetailModal = document.getElementById('year2024DetailModal');
    const close2024DetailModalButton = document.getElementById('close2024DetailModalButton');

    // 「過去セットリスト」モーダルの開閉
    if (openPastSetlistsModalButton && pastSetlistsModal && closePastSetlistsModalButton) {
        openPastSetlistsModalButton.addEventListener('click', () => openModalWithBodyClass('pastSetlistsModal'));
        closePastSetlistsModalButton.addEventListener('click', () => closeModalWithBodyClass('pastSetlistsModal'));
        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) closeModalWithBodyClass('pastSetlistsModal');
        });
    }

    // 2026年セットリスト詳細モーダルの開閉
    if (year2026DetailModal && close2026DetailModalButton) {
        if (open2026FromPastModalButton) {
            open2026FromPastModalButton.addEventListener('click', () => {
                closeModalWithBodyClass('pastSetlistsModal');
                openModalWithBodyClass('year2026DetailModal');
            });
        }
        close2026DetailModalButton.addEventListener('click', () => closeModalWithBodyClass('year2026DetailModal'));
        year2026DetailModal.addEventListener('click', (event) => {
            if (event.target === year2026DetailModal) closeModalWithBodyClass('year2026DetailModal');
        });
    }

    
    // 2025年セットリスト詳細モーダルの開閉
    if (year2025DetailModal && close2025DetailModalButton) {
        if (open2025FromPastModalButton) {
            open2025FromPastModalButton.addEventListener('click', () => {
                closeModalWithBodyClass('pastSetlistsModal');
                openModalWithBodyClass('year2025DetailModal');
            });
        }
        close2025DetailModalButton.addEventListener('click', () => closeModalWithBodyClass('year2025DetailModal'));
        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) closeModalWithBodyClass('year2025DetailModal');
        });
    }

        // 2024年セットリスト詳細モーダルの開閉
    if (year2024DetailModal && close2024DetailModalButton) {
        if (open2024FromPastModalButton) {
            open2024FromPastModalButton.addEventListener('click', () => {
                closeModalWithBodyClass('pastSetlistsModal');
                openModalWithBodyClass('year2024DetailModal');
            });
        }
        close2024DetailModalButton.addEventListener('click', () => closeModalWithBodyClass('year2024DetailModal'));
        year2024DetailModal.addEventListener('click', (event) => {
            if (event.target === year2024DetailModal) closeModalWithBodyClass('year2024DetailModal');
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
                    // ロードが完了したら、両方のモーダルが閉じていることを確認
                    closeModalWithBodyClass('pastSetlistsModal');
                    closeModalWithBodyClass('year2025DetailModal');
                    closeModalWithBodyClass('year2024DetailModal');
                }).catch(error => console.error("[setlist-link click] Error loading setlist:", error));
            } else {
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                // 通常のリンクの場合もモーダルを閉じる
                closeModalWithBodyClass('pastSetlistsModal');
                closeModalWithBodyClass('year2025DetailModal');
                closeModalWithBodyClass('year2024DetailModal');
            }
        });
    });

    // --- 最終クリーンアップと初期ロード ---
    loadSetlistState().then(() => {
        console.log("[DOMContentLoaded] loadSetlistState finished.");

        // URLパラメータをチェック
        const urlParams = new URLSearchParams(window.location.search);
        const hasShareOrPastId = urlParams.has('shareId') || urlParams.has('pastSetlistId');

        if (!hasShareOrPastId) {
            // shareId も pastSetlistId もない場合、日付と会場、初期曲を配置
            console.log("[DOMContentLoaded] No shareId or pastSetlistId. Setting default date/venue and preloading songs.");

            // デフォルトの日付と会場を設定
            const setlistVenue = document.getElementById('setlistVenue');
            if (setlistYear && setlistMonth && setlistDay) {
                setlistYear.value = "2026";
                setlistMonth.value = "02";
                updateDays();
                setlistDay.value = "22";
                console.log(`[DOMContentLoaded] Default date set to 2026/02/22.`);
            }
            if (setlistVenue) {
                setlistVenue.value = "Zepp Haneda 2日目 (克哉生誕祭)";
                console.log(`[DOMContentLoaded] Default venue set to Zepp Haneda 2日目 (克哉生誕祭).`);
            }

            // 初期曲として配置したいアイテムのIDリストとオプション
            const initialItems = [
                { itemId: "album1-se-custom", options: { name: "SE(GROUNDED)~ドラムソロ" } },


                { itemId: "album8-001", options: {} }, 
                { itemId: "album13-002", options: {} }, 
                { itemId: "album2-002", options: {} }, 
                { itemId: "album14-003", options: {} }, 
                { itemId: "album15-043", options: {} }, 
                { itemId: "album9-015", options: {} }, 

                { itemId: "album1-002", options: {} }, 

                { itemId: "album15-019", options: {} }, 
                { itemId: "album12-006", options: {} }, 
                { itemId: "album11-007", options: {} }, 
                { itemId: "album13-001", options: {} }, 
                { itemId: "album13-009", options: {} }, 
                { itemId: "album7-006", options: {} }, 
                { itemId: "album15-044", options: {} }, 

                { itemId: "album1-016", options: {} }, 
                
                { itemId: "album15-021", options: {} }, 
                { itemId: "album14-006", options: {} }, 
                { itemId: "album14-002", options: {} }, 
                { itemId: "album12-002", options: {} }, 
                { itemId: "album14-004", options: {} }, 
                { itemId: "album9-010", options: {} }, 




                // { itemId: "", options: { seChecked: true } },  // SE有り
                // { itemId: "", options: { short: true } }, // Short
                // { itemId: "", options: {} },  
                // { itemId: "album1-custom", options: { name: "コラボ曲" } } // '自由入力曲'の初期値を"コラボ曲"にする
            ];



            initialItems.forEach((item, index) => {
                const slot = document.querySelector(`.setlist-slot[data-slot-index="${index}"]`);
                if (slot && !slot.classList.contains('setlist-item')) {
                    const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${item.itemId}"]`);
                    
                    if (originalAlbumItem) {
                        // 元のアルバムアイテムからデータを取得
                        if (typeof getSlotItemData === 'function' && typeof fillSlotWithItem === 'function') {
                            const songData = getSlotItemData(originalAlbumItem);

                            // initialItemsで指定されたオプションの有無を強制的に有効化
                            if (item.options.short !== undefined) {
                                songData.isShortVersion = true;
                            }
                            if (item.options.seChecked !== undefined) {
                                songData.hasSeOption = true;
                            }
                            if (item.options.drumsoloChecked !== undefined) {
                                songData.drumsoloOption = true;
                            }

                            // 全てのチェックボックスをデフォルトでオフに設定
                            songData.short = false;
                            songData.seChecked = false;
                            songData.drumsoloChecked = false;

                            // initialItemsのオプションでチェック状態を正確に上書き
                            if (item.options.short !== undefined) {
                                songData.short = item.options.short;
                            }
                            if (item.options.seChecked !== undefined) {
                                songData.seChecked = item.options.seChecked;
                            }
                            if (item.options.drumsoloChecked !== undefined) {
                                songData.drumsoloChecked = item.options.drumsoloChecked;
                            }
                            if (item.options.name !== undefined) {
                                songData.name = item.options.name;
                            }

                            fillSlotWithItem(slot, songData);
                            console.log(`[DOMContentLoaded] Preloaded item ${songData.name} (ID: ${item.itemId}) into slot ${index}.`);
                        } else {
                            console.warn("[DOMContentLoaded] Required functions (getSlotItemData or fillSlotWithItem) not found for preloading.");
                        }
                    } else {
                        console.warn(`[DOMContentLoaded] Original album item with ID ${item.itemId} not found. Cannot preload.`);
                    }
                }
            });
        }

        // Firebaseロード後、または初期曲追加後に、メニュー表示状態を同期
        if (typeof hideSetlistItemsInMenu === 'function') {
            hideSetlistItemsInMenu();
        } else {
            console.warn("hideSetlistItemsInMenu function not found.");
        }
        
        // 初期ロード後、すべてのセットリストスロットのpointer-eventsを適切に設定
        document.querySelectorAll('.setlist-slot').forEach(slot => {
            slot.style.pointerEvents = 'auto'; // すべてのスロットを常に auto に
            
            // ★★★ 修正: 残っていた touch-action の JS設定を削除 ★★★
            // slot.style.touchAction = 'pan-y'; // ← この行を削除
        });

    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        if (typeof hideSetlistItemsInMenu === 'function') {
            hideSetlistItemsInMenu(); // エラー時もアルバムメニューの表示を更新
        }
    });
});