// =============================================================================
// グローバル変数とDOM要素の参照
// =============================================================================

let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let currentTouchDraggedClone = null; // ★追加：タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムID (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
let touchTimeout = null; // setTimeout のIDを保持する変数
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap
let originalSetlistSlot = null; // PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26; // セットリストの最大曲数

let currentDropZone = null;
let activeTouchSlot = null; // モバイルでのドロップゾーンハイライト用
let rafId = null; // requestAnimationFrame のID

let currentTouchDraggedOriginalElement = null; // ★追加：モバイルのタッチドラッグで元の要素を保持

// アルバム1として扱うdata-item-idのリスト（共有テキスト、PDF生成時に使用）
const album1ItemIds = [
    'album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006',
    'album1-007', 'album1-008', 'album1-009', 'album1-010', 'album1-011',
    'album1-003', 'album1-012', 'album1-013' // 修正済み：album1-003を追加
];

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
 * スロット内のアイテムからデータを抽出し、オブジェクトとして返す。
 * @param {Element} element - データ抽出元の要素 (setlist-item, album .item, or clone)
 * @returns {object|null} 曲のデータオブジェクト、またはnull
 */
function getSlotItemData(element) {
    if (!element) {
        console.warn("[getSlotItemData] Provided element is null. Returning null.");
        return null;
    }

    const isSetlistItem = element.classList.contains('setlist-item');
    const isAlbumItem = element.classList.contains('item') && !isSetlistItem; // album item は setlist-item でない

    let songName = '';
    let isCheckedShort = false;
    let isCheckedSe = false;
    let isCheckedDrumsolo = false;
    // hasShortOptionなどは、そのオプションが「設定可能」かどうかを示すもの
    let hasShortOption = false; 
    let hasSeOption = false;
    let hasDrumsoloOption = false;
    
    // albumClass は element.classList から取得
    const albumClass = Array.from(element.classList).find(className => className.startsWith('album'));
    let itemId = element.dataset.itemId;

    // dataset から取得する際は、デフォルト値を設定
    let rGt = element.dataset.rGt || '';
    let lGt = element.dataset.lGt || '';
    let bass = element.dataset.bass || '';
    let bpm = element.dataset.bpm || '';
    let chorus = element.dataset.chorus || ''; // コーラスは単なる表示フラグなので文字列のままで良い

    if (isSetlistItem) {
        // セットリストアイテムの場合、表示されている内容から取得する
        songName = element.dataset.songName || ''; // dataset から曲名を取得
        // チェックボックスの状態を直接見る
        isCheckedShort = element.querySelector('input[type="checkbox"][data-option-type="short"]')?.checked || false;
        isCheckedSe = element.querySelector('input[type="checkbox"][data-option-type="se"]')?.checked || false;
        isCheckedDrumsolo = element.querySelector('input[type="checkbox"][data-option-type="drumsolo"]')?.checked || false;
        
        // 元々そのオプションがあったかどうかはdatasetから
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.drumsoloOption === 'true';

    } else if (isAlbumItem) {
        // アルバムアイテムの場合、datasetから直接取得
        songName = element.dataset.songName || element.textContent.trim();
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.drumsoloOption === 'true';
        
        // アルバムアイテムでは、これらのオプションは「設定可能かどうか」であり、
        // チェックされた状態はセットリストに移動した際に初めて持つものなので、ここではfalse
        isCheckedShort = false;
        isCheckedSe = false;
        isCheckedDrumsolo = false;

    } else if (element.dataset.itemId) { // クローン要素などの場合 (datasetから取得)
        songName = element.dataset.songName || '';
        isCheckedShort = element.dataset.short === 'true'; // クローンでは dataset.short が現在の状態を示す
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';
        
        hasShortOption = element.dataset.isShortVersion === 'true'; // クローンは元の要素のデータ属性を継承
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.drumsoloOption === 'true';
    } else {
        console.warn("[getSlotItemData] Element has no recognizable data for item:", element);
        return null;
    }

    return {
        name: songName,
        short: isCheckedShort, // 現在チェックされているか
        seChecked: isCheckedSe, // 現在チェックされているか
        drumsoloChecked: isCheckedDrumsolo, // 現在チェックされているか
        hasShortOption: hasShortOption, // このオプションが元々存在するか（表示するかどうか）
        hasSeOption: hasSeOption, // このオプションが元々存在するか
        hasDrumsoloOption: hasDrumsoloOption, // このオプションが元々存在するか
        albumClass: albumClass,
        itemId: itemId,
        slotIndex: element.dataset.slotIndex,
        rGt: rGt,
        lGt: lGt,
        bass: bass,
        bpm: bpm,
        chorus: chorus
    };
}

/**
 * 指定されたセットリストのスロットからアイテムをクリアする。
 * @param {HTMLElement} slotElement - クリアするセットリストのスロット要素。
 */
function clearSlotContent(slotIndex) {
    if (slotIndex === null || isNaN(slotIndex)) {
        console.error(`[clearSlotContent] Invalid slotIndex received: ${slotIndex}. Aborting clear.`);
        return;
    }
    const slotElement = document.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (slotElement) {
        const currentItem = slotElement.querySelector('.setlist-item');
        if (currentItem) {
            currentItem.remove();
            console.log(`[clearSlotContent] Slot ${slotIndex} cleared successfully.`);
        } else {
            console.log(`[clearSlotContent] Slot ${slotIndex} already empty.`);
        }
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
 * セットリストにある曲をアルバムメニュー内で非表示にする。
 */
function hideSetlistItemsInMenu() {
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");
    // まずすべてのアルバムアイテムを可視状態に戻す
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.visibility = ''; // CSSのデフォルトに戻す
    });

    const currentSetlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    if (currentSetlistItems.length === 0) {
        console.log("[hideSetlistItemsInMenu] Setlist is empty, all album items should be visible.");
        return;
    }

    const setlistItemIds = new Set();
    currentSetlistItems.forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            setlistItemIds.add(itemId);
        }
    });

    albumList.querySelectorAll('.item').forEach(albumItem => { // albumListから探索
        if (albumItem.dataset.itemId && setlistItemIds.has(albumItem.dataset.itemId)) {
            albumItem.style.visibility = 'hidden';
            console.log(`[hideSetlistItemsInMenu] HIDDEN: Album item in menu: ${albumItem.dataset.itemId}`);
        }
    });
    console.log("[hideSetlistItemsInMenu] END: Finished updating album menu item visibility.");
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
        setlist: setlistState,
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
    // songData.short, songData.seChecked, songData.drumsoloChecked は addSongToSlot の options で使用される
    addSongToSlot(slotElement, songData.itemId, songData.name, {
        isShortVersion: songData.hasShortOption, // `has`プロパティは、そのオプションが「設定可能」かどうか
        hasSeOption: songData.hasSeOption,
        drumsoloOption: songData.hasDrumsoloOption,
        rGt: songData.rGt,
        lGt: songData.lGt,
        bass: songData.bass,
        bpm: songData.bpm,
        chorus: songData.chorus,
        // そして、実際にチェックされているかどうかの状態も渡す
        short: songData.short, 
        seChecked: songData.seChecked,
        drumsoloChecked: songData.drumsoloChecked
    }, songData.albumClass);
    
    // ここでチェックボックスの実際の状態を反映 (updateSlotContent内で処理されるので不要になるはず)
    // ただし、updateSlotContent が options から直接チェックボックスの状態を判断する必要がある
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
    const originalElement = event.target.closest(".item") || event.target.closest(".setlist-item");
    if (!originalElement) {
        console.warn("[dragstart:PC] No draggable item found. Returning null.");
        event.preventDefault(); // ドラッグをキャンセル
        return;
    }

    draggingItemId = originalElement.dataset.itemId;
    event.dataTransfer.setData("text/plain", draggingItemId);
    event.dataTransfer.effectAllowed = "move";

    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        // originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot); // このデータは現在使われていないのでコメントアウト
        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot');
        currentPcDraggedElement = originalElement;
        console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
    } else {
        originalSetlistSlot = null; // アルバムからのドラッグ
        currentPcDraggedElement = originalElement; // アルバムアイテム自体を参照
        // アルバムアイテムはドラッグ開始時には隠さない。ドロップ時にhideSetlistItemsInMenuで隠れる。
        console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the currentPcDraggedElement.`);
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
    currentPcDraggedElement.classList.add("dragging"); // PCドラッグ中の要素にクラスを追加
    console.log(`[dragstart] dataTransfer set with: ${draggingItemId}`);
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
 * ドラッグオーバー時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
    if (!draggingItemId) return;

    const targetSlot = event.target.closest('.setlist-slot');
    const newDropZone = targetSlot;

    // すべてのスロットから drag-over クラスを一度削除する
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
    });

    if (newDropZone && !(originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex)) {
        newDropZone.classList.add('drag-over');
        // ドロップターゲットとして有効にする
        newDropZone.style.pointerEvents = 'auto'; // ★修正：ドラッグオーバー中にpointer-eventsをautoにする
        currentDropZone = newDropZone;
    } else {
        if (currentDropZone) {
            currentDropZone.classList.remove('drag-over');
            // currentDropZone.style.pointerEvents = ''; // 一時的にコメントアウト。finishDraggingで一括制御
            currentDropZone = null;
        }
    }
}

/**
 * ドロップ処理を実行する関数。
 * @param {HTMLElement} draggedElement - ドロップされた要素（クローンまたは元の要素）。
 * @param {HTMLElement} dropTargetSlot - ドロップされた先のセットリストスロット。
 * @param {HTMLElement | null} originalSourceSlot - 元のセットリストスロット（セットリスト内からのドラッグの場合）。
 */
function processDrop(draggedElement, dropTargetSlot, originalSourceSlot) {
    console.log('[processDrop] Initiated.');
    console.log('Dragged Element:', draggedElement);
    console.log('Drop Target Slot:', dropTargetSlot);
    console.log('Original Source Slot:', originalSourceSlot);

    if (!draggedElement) {
        console.error('[processDrop] draggedElement is null. Aborting drop.');
        finishDragging(true); // ドラッグをキャンセルしてクリーンアップ
        return;
    }

    const itemId = draggedElement.dataset.itemId;
    const songName = draggedElement.dataset.songName;
    const isShortVersion = draggedElement.dataset.isShortVersion === 'true';
    const hasSeOption = draggedElement.dataset.hasSeOption === 'true';
    const drumsoloOption = draggedElement.dataset.drumsoloOption === 'true';
    const rGt = draggedElement.dataset.rGt;
    const lGt = draggedElement.dataset.lGt;
    const bass = draggedElement.dataset.bass;
    const bpm = draggedElement.dataset.bpm;
    const chorus = draggedElement.dataset.chorus === 'true';
    const albumId = draggedElement.classList.contains('album1') ? 'album1' : 'album2'; // または適切な方法でアルバムIDを取得

    // ドロップターゲットが無効な場合、元の位置に戻すか、何もしない
    if (dropTargetSlot === null || isNaN(dropTargetSlot)) {
        console.warn('[processDrop] Invalid drop target slot. Cancelling drop or returning to original position.');
        showMessageBox("無効なドロップ位置です。", "error");
        finishDragging(true); // ドラッグをキャンセルしてクリーンアップ
        return;
    }

    // セットリスト内での移動
    if (originalSourceSlot !== -1 && !isNaN(originalSourceSlot)) {
        console.log('[processDrop] Moving item within setlist.');

        // 同じスロットにドロップした場合
        if (originalSourceSlot === dropTargetSlot) {
            console.log('[processDrop] Dropped back into the same slot. No change.');
            showMessageBox("同じ位置にドロップしました。", "info");
            finishDragging(false); // 正常に終了
            return;
        }

        // 移動先のスロットの内容を取得
        const targetSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${dropTargetSlot}"]`);
        let existingItemInTargetSlot = null;
        let existingItemIdInTargetSlot = null;

        if (targetSlotElement && targetSlotElement.querySelector('.setlist-item')) {
            existingItemInTargetSlot = targetSlotElement.querySelector('.setlist-item');
            existingItemIdInTargetSlot = existingItemInTargetSlot.dataset.itemId;
        }

        // 元のスロットのクリア (既存のアイテムがあれば)
        const originalSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${originalSourceSlot}"]`);
        if (originalSlotElement) {
            // スロットの `pointer-events` を auto に戻す
            originalSlotElement.style.pointerEvents = 'auto';
            originalSlotElement.style.touchAction = 'pan-y'; // 必要に応じて
            // プレースホルダーを削除
            originalSlotElement.classList.remove('placeholder');

            // 既存のアイテムを完全にクリアするのではなく、元のスロットを空にする
            const currentItemInOriginalSlot = originalSlotElement.querySelector('.setlist-item');
            if (currentItemInOriginalSlot) {
                currentItemInOriginalSlot.remove();
                console.log(`[clearSlotContent] Slot ${originalSourceSlot} content removed.`);
            }
        } else {
            console.warn(`[processDrop] Original slot element not found for index ${originalSourceSlot}`);
        }

        // 新しい場所へアイテムを追加
        addSongToSlot(itemId, dropTargetSlot, {
            isShortVersion,
            hasSeOption,
            drumsoloOption,
            rGt,
            lGt,
            bass,
            bpm,
            chorus
        }, albumId);

        // 元のスロットにターゲットにあったアイテムを移動
        if (existingItemInTargetSlot) {
            console.log(`[processDrop] Moving existing item ${existingItemIdInTargetSlot} from slot ${dropTargetSlot} to original slot ${originalSourceSlot}.`);
            // ここで、既存のアイテムを元のスロットに移動する処理を呼び出す
            // addSongToSlot を再利用するか、新しい関数を作成します
            addSongToSlot(existingItemIdInTargetSlot, originalSourceSlot, {
                isShortVersion: existingItemInTargetSlot.dataset.isShortVersion === 'true',
                hasSeOption: existingItemInTargetSlot.dataset.hasSeOption === 'true',
                drumsoloOption: existingItemInTargetSlot.dataset.drumsoloOption === 'true',
                rGt: existingItemInTargetSlot.dataset.rGt,
                lGt: existingItemInTargetSlot.dataset.lGt,
                bass: existingItemInTargetSlot.dataset.bass,
                bpm: existingItemInTargetSlot.dataset.bpm,
                chorus: existingItemInTargetSlot.dataset.chorus === 'true'
            }, albumId); // アルバムIDは元のアイテムから取得するか、正しく決定する
        } else {
            console.log(`[processDrop] Target slot ${dropTargetSlot} was empty. No swap needed.`);
        }

        showMessageBox("セットリスト内の曲を移動しました。", "success");

    } else {
        // アルバムメニューからセットリストへの追加（既存のロジックを保持）
        console.log('[processDrop] Adding item from album menu to setlist.');
        addSongToSlot(itemId, dropTargetSlot, {
            isShortVersion,
            hasSeOption,
            drumsoloOption,
            rGt,
            lGt,
            bass,
            bpm,
            chorus
        }, albumId);
        showMessageBox("セットリストに曲を追加しました。", "success");
    }

    finishDragging(false); // ドラッグ状態のクリーンアップ
    hideSetlistItemsInMenu(); // セットリストの変更に伴いメニューを更新
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

    let draggedItem;
    if (originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId) {
        draggedItem = originalSetlistSlot;
    } else {
        // アルバムアイテムの場合
        draggedItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
    }

    if (!draggedItem) {
        console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". Aborting.");
        finishDragging();
        return;
    }
    console.log("[handleDrop] draggedItem found:", draggedItem);

    const dropTargetSlot = event.target.closest('.setlist-slot');
    console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
    finishDragging(); // ドロップ処理後に必ずクリーンアップ
}

/**
 * タッチ開始時の処理 (モバイル向け)。
 */
// main.js の touchstart イベントハンドラを見つけます (約660行目あたり)

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

    // ドラッグ対象要素が setlist-item かつ draggable="true" を持っていることを確認
    if (touchedElement.classList.contains('setlist-item') && touchedElement.draggable) {
        event.preventDefault(); // デフォルトのスクロール動作などを防ぐ

        // ここで originalSourceSlot を確実に取得します
        const slotIndex = touchedElement.dataset.slotIndex;
        // null または undefined の場合は-1など、無効な値に設定
        currentDraggingItem.originalSourceSlot = slotIndex !== undefined && slotIndex !== null ? parseInt(slotIndex, 10) : -1;

        console.log(`[touchstart:Mobile] Dragging from setlist slot: ${currentDraggingItem.originalSourceSlot}`);

        // ドラッグ開始のためのタイマーを設定
        touchDragTimeout = setTimeout(() => {
            if (currentDraggingItem.originalSourceSlot !== -1) {
                // clone の作成と original の非表示
                createTouchDraggedClone(touchedElement);
                // オリジナルのスロットを隠し、プレースホルダーとしてマーク
                const originalSlotElement = document.querySelector(`.setlist-slot[data-slot-index="${currentDraggingItem.originalSourceSlot}"]`);
                if (originalSlotElement) {
                    originalSlotElement.style.visibility = 'hidden';
                    originalSlotElement.classList.add('placeholder');
                    console.log(`[touchstart:Mobile] Original setlist slot ${currentDraggingItem.originalSourceSlot} hidden and marked as placeholder.`);
                }
                isDragging = true;
                console.log('[touchstart:Mobile] Dragging initiated after timeout. Clone created and original hidden.');
            } else {
                console.warn('[touchstart:Mobile] Dragging initiated but originalSourceSlot is invalid. Cancelling drag.');
                finishDragging(true); // ドラッグをキャンセル
            }
        }, 150); // ドラッグ開始までの遅延
    } else {
        // ダブルクリック処理 (既存のロジックがあればここに追加)
        handleDoubleClick(event, touchedElement);
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

    // ドラッグオーバーのハイライトをリセットし、すべてのスロットのpointer-eventsをリセット
    document.querySelectorAll('.setlist-slot').forEach(slot => { // ★修正：すべてのスロットを対象に
        slot.classList.remove('drag-over');
        // ドラッグ中は、すべてのスロットがドロップターゲットになる可能性があるため auto にする
        slot.style.pointerEvents = 'auto'; // ★修正：タッチ移動中もpointer-eventsをautoにする
    });

    // 現在のタッチ位置にある要素を取得
    const elementsAtPoint = document.elementsFromPoint(currentX, currentY);

    // ドロップ可能なセットリストスロットを探す
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot) {
        // ターゲットスロットが自身の元のスロットでない、かつ有効なドロップターゲットである場合
        const isSelfSlot = originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;
        
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
        const dropTargetElement = document.elementFromPoint(touch.clientX, touch.clientY);

        // ドロップターゲットがセットリストのスロットであるか、その中のアイテムであるかを確認
        let dropSlotElement = dropTargetElement.closest('.setlist-slot');
        if (!dropSlotElement) {
            // ドラッグ中のアイテム自身ではないか確認し、親のスロットを探す
            if (dropTargetElement.classList.contains('setlist-item')) {
                dropSlotElement = dropTargetElement.closest('.setlist-slot');
            }
        }

        let dropTargetSlotIndex = null;
        if (dropSlotElement) {
            dropTargetSlotIndex = parseInt(dropSlotElement.dataset.slotIndex, 10);
        }

        console.log('[touchend] Drop target slot:', dropTargetSlotIndex);

        // ドロップ処理を実行
        processDrop(currentDraggingItem.draggedElement, dropTargetSlotIndex, currentDraggingItem.originalSourceSlot);

        isDragging = false;
        currentDraggingItem.draggedElement = null;
        currentDraggingItem.originalSourceSlot = -1; // リセット
    } else {
        // ドラッグではない場合の処理
        console.log('[touchend] Not dragging. No action taken.');
    }
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
 * ドラッグ&ドロップの終了処理をまとめた関数。
 * @param {boolean} [isCancelled=false] - ドラッグがキャンセルされたかどうか。
 */
function finishDragging(cancelled) {
    console.log('[finishDragging] Cleaning up dragging state. Cancelled:', cancelled);

    // ドラッグ中のクローン要素を削除
    const draggedClone = document.querySelector('.touch-dragging-clone');
    if (draggedClone) {
        draggedClone.remove();
    }

    // placeholder クラスと visibility:hidden を削除
    // すべてのセットリストスロットをチェックする
    document.querySelectorAll('.setlist-slot.placeholder').forEach(slot => {
        slot.style.visibility = 'visible';
        slot.classList.remove('placeholder');
    });

    // ドラッグ関連のグローバル変数をリセット
    isDragging = false;
    currentDraggingItem.draggedElement = null;
    currentDraggingItem.originalSourceSlot = -1; // ここで確実にリセット

    // touchDragTimeout が設定されている場合はクリア
    if (touchDragTimeout) {
        clearTimeout(touchDragTimeout);
        touchDragTimeout = null;
    }

    // メニュー表示の更新など、必要に応じて他のクリーンアップ処理を追加
    hideSetlistItemsInMenu(); // セットリストの表示状態を更新

    console.log('[finishDragging] Dragging state cleaned up.');
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
                isShortVersion: songData.hasShortOption, // アルバムからの追加なので、初期状態は「持っているか」を反映
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
        return; // アルバムアイテムの処理が完了したので終了
    }

    // 次に、セットリストの曲がダブルクリックされたかチェック
    let setlistItemElement = event.target.closest('.setlist-slot.setlist-item');
    if (setlistItemElement) {
        // セットリストのアイテムがダブルクリックされたら、常に削除処理を行う
        console.log(`[handleDoubleClick] Double-clicked setlist item: ID=${setlistItemElement.dataset.itemId}, Slot Index=${setlistItemElement.dataset.slotIndex}. Restoring to original list.`);
        restoreToOriginalList(setlistItemElement);
        return; // 処理完了
    }

    console.log("[handleDoubleClick] No valid setlist item or album item found for double click. Event target was:", event.target);
}


// =============================================================================
// PDF生成機能
// =============================================================================

/**
 * セットリストのPDFを生成し、共有またはダウンロードする。
 * 提供されたPDF形式（テーブル形式）に似たレイアウトで生成し、日本語に対応。
 * jsPDF-AutoTableを使用する。
 */
async function generateSetlistPdf() {
    showMessage("PDFを生成中...", "info"); // showMessageBox から showMessage に変更
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
    const simplePdfBody = []; // シンプルなPDF用のボディ
    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

    let currentItemNoDetailed = 1; // 詳細PDF用の連番カウンタ
    let currentItemNoSimple = 1;  // シンプルPDF用の連番カウンタ（非album1曲用）
    let currentItemNoShareable = 1; // 共有テキスト用の連番カウンタ

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

            // 詳細PDF用の行
            const detailedRowNo = isAlbum1 ? '' : (currentItemNoDetailed++).toString();
            tableBody.push([
                detailedRowNo, titleText, songData.rGt || '', songData.lGt || '',
                songData.bass || '', songData.bpm || '', (songData.chorus === 'true' ? '有' : '') // 'true'を'有'に変換
            ]);

            // シンプルPDF用の行
            if (isAlbum1) {
                simplePdfBody.push(`    ${titleText}`);
            } else {
                simplePdfBody.push(`${currentItemNoSimple++}. ${titleText}`);
            }

            // 共有テキスト用の行
            if (isAlbum1) {
                shareableTextContent += `    ${titleText}\n`;
            } else {
                shareableTextContent += `${currentItemNoShareable++}. ${titleText}\n`;
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                tableBody.push([textContent, '', '', '', '', '', '']); // 空のセルで埋める
                simplePdfBody.push(textContent);
                shareableTextContent += `${textContent}\n`;
            }
        }
    }

    console.log("[generateSetlistPdf] Generated Shareable Text:\n", shareableTextContent);

    try {
        const { jsPDF } = window.jspdf;
        // jsPDF-AutoTable の日本語フォント登録関数 (外部ファイルまたはコードの冒頭で定義)
        function registerJapaneseFont(doc) {
            // NotoSansJP-Regular.ttf の base64 エンコード文字列を別途用意する必要があります。
            // 非常に長くなるため、ここでは省略します。
            // 実際のアプリケーションでは、ここにフォントのBase64文字列を埋め込むか、
            // 外部ファイルからロードする仕組みが必要です。
            // 例: doc.addFileToVFS('NotoSansJP-Regular.ttf', '...');
            // doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
            // doc.addFont('NotoSansJP-Bold.ttf', 'NotoSansJP', 'bold');
            console.warn("Japanese font for jsPDF is not embedded. PDF might not display Japanese characters correctly without it.");
            // デモンストレーションのため、フォントが見つからない場合はデフォルトフォントを使用します。
            // 実際の運用では必ずフォントを組み込んでください。
            doc.setFont('helvetica'); // fallback
        }

        // --- 1. 詳細なセットリストPDFの生成 ---
        const detailedPdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(detailedPdf); // フォント登録

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
            detailedPdf.setFont('NotoSansJP', 'bold'); // フォントが登録されていれば適用される
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
                font: 'NotoSansJP', fontSize: 10, cellPadding: 2, // フォントが登録されていれば適用される
                lineColor: [0, 0, 0], lineWidth: 0.3, textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [220, 220, 220], textColor: [0, 0, 0],
                font: 'NotoSansJP', fontStyle: 'bold', halign: 'center' // フォントが登録されていれば適用される
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
                detailedPdf.setFont('NotoSansJP', 'normal'); // フォントが登録されていれば適用される
                detailedPdf.text('Page ' + detailedPdf.internal.getNumberOfPages(), detailedPdf.internal.pageSize.getWidth() - 10, detailedPdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        });

        const detailedFilename = `セットリスト_詳細_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        detailedPdf.save(detailedFilename);
        console.log("[generateSetlistPdf] Detailed PDF generated and downloaded:", detailedFilename);

        await new Promise(resolve => setTimeout(resolve, 500)); // 少し待機

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf); // フォント登録

        simplePdf.setFont('NotoSansJP', 'bold'); // フォントが登録されていれば適用される
        const simpleFontSize = 28;
        simplePdf.setFontSize(simpleFontSize);

        const simpleTopMargin = 30;
        let simpleYPos = simpleTopMargin;
        const simpleLeftMargin = 25;

        if (headerText) {
            simplePdf.setFontSize(simpleFontSize + 8); // ヘッダーフォントサイズを大きく
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 1.5; // ヘッダーと曲リストの間の余白を増やす
            simplePdf.setFontSize(simpleFontSize); // 曲リスト用に戻す
        }

        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 1.25; // 曲間の行間隔

            const bottomMarginThreshold = simpleFontSize + 10;
            if (simpleYPos > simplePdf.internal.pageSize.getHeight() - bottomMarginThreshold) {
                simplePdf.addPage();
                simpleYPos = simpleTopMargin;
                simplePdf.setFont('NotoSansJP', 'bold'); // フォントが登録されていれば適用される
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
// Firebase連携と状態管理
// =============================================================================

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
    if (typeof firebase === 'undefined' || !firebase.database) {
        showMessage('Firebaseが初期化されていません。', 'error'); // showMessageBox から showMessage に変更
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    const currentState = getCurrentState();
    const setlistRef = database.ref('setlists').push();

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
            let shareableTextItemNo = 1; // 共有テキスト用の連番カウンタ

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
                tempInput.value = `${shareText}\n共有リンク: ${shareLink}`; // テキストとリンクを両方コピー
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
    if (options.isShortVersion) { // isShortVersionは、そのオプションが「存在しうるか」
        hasAnyCheckboxOption = true;
        const shortVersionCheckboxWrapper = createCheckboxWrapper('短縮', options.short, (e) => { // options.shortが現在のチェック状態
            // dataset の更新
            slotElement.dataset.short = e.target.checked.toString();
            // 親要素のクラスも更新 (CSSスタイリング用)
            slotElement.classList.toggle('short', e.target.checked);
            // options オブジェクトのコピーを作成し、現在のチェック状態を更新して再描画
            updateSlotContent(slotElement, songName, { ...options, short: e.target.checked });
        });
        // data-option-type を設定して、クリックハンドラで判別できるようにする
        shortVersionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'short';
        itemOptions.appendChild(shortVersionCheckboxWrapper);
    }

    // SE有無
    if (options.hasSeOption) { // hasSeOptionは、そのオプションが「存在しうるか」
        hasAnyCheckboxOption = true;
        const seOptionCheckboxWrapper = createCheckboxWrapper('SE', options.seChecked, (e) => { // options.seCheckedが現在のチェック状態
            slotElement.dataset.seChecked = e.target.checked.toString();
            slotElement.classList.toggle('se-active', e.target.checked);
            updateSlotContent(slotElement, songName, { ...options, seChecked: e.target.checked });
        });
        seOptionCheckboxWrapper.querySelector('input[type="checkbox"]').dataset.optionType = 'se';
        itemOptions.appendChild(seOptionCheckboxWrapper);
    }

    // ドラムソロ有無
    if (options.drumsoloOption) { // drumsoloOptionは、そのオプションが「存在しうるか」
        hasAnyCheckboxOption = true;
        const drumsoloOptionCheckboxWrapper = createCheckboxWrapper('ドラムソロ', options.drumsoloChecked, (e) => { // options.drumsoloCheckedが現在のチェック状態
            slotElement.dataset.drumsoloChecked = e.target.checked.toString();
            slotElement.classList.toggle('drumsolo-active', e.target.checked);
            updateSlotContent(slotElement, songName, { ...options, drumsoloChecked: e.target.checked });
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
    // 値が存在する場合のみ追加
    if (options.rGt) infoParts.push(`R.GT: ${options.rGt}`);
    if (options.lGt) infoParts.push(`L.GT: ${options.lGt}`);
    if (options.bass) infoParts.push(`Ba: ${options.bass}`);
    if (options.bpm) infoParts.push(`BPM: ${options.bpm}`);
    // コーラスは 'true'/'false' 文字列で来るので、'true'の場合のみ表示
    if (options.chorus === 'true') infoParts.push(`コーラス`); 

    if (infoParts.length > 0) {
        additionalInfoDiv.textContent = infoParts.join(' | ');
        songInfoContainer.appendChild(additionalInfoDiv);
    }

    slotElement.appendChild(songInfoContainer);

    // ドラッグハンドルの追加 (右端)
    const dragHandle = document.createElement('span');
    dragHandle.classList.add('drag-handle');
    dragHandle.textContent = '☰'; // ハンバーガーアイコンなどのUnicode文字
    slotElement.appendChild(dragHandle);
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
function addSongToSlot(itemId, slotIndex, options, albumId) {
    if (slotIndex === null || isNaN(slotIndex)) {
        console.error(`[addSongToSlot] Invalid slotIndex received: ${slotIndex}. Aborting add.`);
        return;
    }
    console.log(`[addSongToSlot] Adding song ${getSongNameById(itemId)} (${itemId}) to slot ${slotIndex}. Album: ${albumId}`);
    console.log('[addSongToSlot] Options received:', options);

    const slotElement = document.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (!slotElement) {
        console.error(`[addSongToSlot] Slot element not found for index: ${slotIndex}`);
        return;
    }

    // 既存のコンテンツをクリア
    // ここで slotElement.innerHTML = '' する前に、既存の setlist-item を確実に削除する
    const existingItem = slotElement.querySelector('.setlist-item');
    if (existingItem) {
        existingItem.remove();
    }

    const songData = getSongDataById(itemId); // songData を取得する関数があるとして
    if (!songData) {
        console.error(`[addSongToSlot] Song data not found for item ID: ${itemId}`);
        return;
    }

    const itemHtml = createSetlistItemHtml(itemId, songData.name, options, albumId); // HTML生成関数
    slotElement.insertAdjacentHTML('afterbegin', itemHtml); // 新しいアイテムを追加

    // 新しく追加されたアイテムのイベントリスナーを再設定
    const newItemElement = slotElement.querySelector(`.setlist-item[data-item-id="${itemId}"]`);
    if (newItemElement) {
        setupDragEventsForSetlistItem(newItemElement); // ドラッグイベントを再設定
    }

    updateSetlistData(slotIndex, itemId, options, albumId); // セットリストの内部データ構造を更新

    console.log(`[addSongToSlot] Successfully added song ${getSongNameById(itemId)} to slot ${slotIndex}.`);
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
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
        element.addEventListener("dblclick", handleDoubleClick); // ダブルクリックリスナーを追加
    }

    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
        // セットリストスロットにもダブルクリックリスナーを追加（アルバムアイテムと同じ）
        // setlist-itemクラスが付与されているスロットのみに有効にしたい場合は、ここで条件を追加
        // if (element.classList.contains('setlist-item')) {
        //     element.addEventListener("dblclick", handleDoubleClick);
        // }
    }
    // スロットが空の場合、pointer-events: none; に設定する（DOMContentLoadedとfinishDraggingで最終的に制御）
    // enableDragAndDropが呼ばれた時点では、まだアイテムが入っていない可能性もあるため、
    // ここで一律に none にはせず、finishDraggingに任せるのが安全
}


function initializeSetlistSlots() {
    const setlistContainer = document.querySelector('.setlist-container');
    if (!setlistContainer) return;

    // 現在のスロット数を取得
    const existingSlots = setlistContainer.querySelectorAll('.setlist-slot').length;

    // 必要に応じてスロットを追加（例: 10個のスロットを保証）
    const targetSlotCount = 10; // 必要に応じて調整
    for (let i = existingSlots; i < targetSlotCount; i++) {
        const slot = document.createElement('li');
        slot.classList.add('setlist-slot');
        slot.setAttribute('data-slot-index', i); // ここが重要
        slot.innerHTML = `<span class="slot-number">${i + 1}.</span><span class="song-info"></span>`; // スロットの初期コンテンツ
        setlistContainer.appendChild(slot);
    }

    // 既存のスロットにも data-slot-index が確実に設定されているか確認するループを追加
    setlistContainer.querySelectorAll('.setlist-slot').forEach((slot, index) => {
        slot.setAttribute('data-slot-index', index);
        // ドラッグイベントリスナーをここで設定する方が良いかもしれません
        // setlist slots のイベントリスナー設定をここに統合することも検討してください
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('drop', handleDrop);
        slot.addEventListener('dragleave', handleDragLeave);
    });

    console.log('[initializeSetlistSlots] Setlist slots initialized with data-slot-index.');
}



// ページロード時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application.");

    // --- ドラッグ＆ドロップ関連の初期設定 ---
    document.querySelectorAll(".album-content .item").forEach(item => {
        enableDragAndDrop(item);
    });

    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        if (!slot.dataset.slotIndex) {
            slot.dataset.slotIndex = index.toString();
        }
        enableDragAndDrop(slot);

        // スロット内のチェックボックスに対するイベントリスナー（バブリング対策）
        // updateSlotContent/addSongToSlot内で作成されるチェックボックスにイベントを再バインドするため、
        // ここでの汎用的なクリックリスナーは必要に応じて調整
        slot.addEventListener('click', (e) => {
            const checkbox = e.target.closest('input[type="checkbox"]');
            if (checkbox && slot.classList.contains('setlist-item')) { // setlist-itemクラスがある場合のみ
                e.stopPropagation(); // 親要素へのイベント伝播を停止
                const optionType = checkbox.dataset.optionType;
                
                // datasetの更新は updateSlotContent に任せるため、ここでは直接変更しない
                // updateSlotContent を呼び出すことで、DOMとdatasetが同期される
                const currentSongData = getSlotItemData(slot);
                if (currentSongData) {
                    const newOptions = { ...currentSongData, 
                        short: currentSongData.short, 
                        seChecked: currentSongData.seChecked, 
                        drumsoloChecked: currentSongData.drumsoloChecked 
                    };
                    if (optionType === 'short') newOptions.short = checkbox.checked;
                    else if (optionType === 'se') newOptions.seChecked = checkbox.checked;
                    else if (optionType === 'drumsolo') newOptions.drumsoloChecked = checkbox.checked;

                    updateSlotContent(slot, currentSongData.name, newOptions);
                    console.log(`[slotClick] Slot ${slot.dataset.slotIndex} ${optionType} status changed to: ${checkbox.checked}`);
                }
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
                    // ロードが完了したら、両方のモーダルが閉じていることを確認
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (year2025DetailModal) year2025DetailModal.classList.remove('active');
                }).catch(error => console.error("[setlist-link click] Error loading setlist:", error));
            } else {
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                // 通常のリンクの場合もモーダルを閉じる
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                if (year2025DetailModal) year2025DetailModal.classList.remove('active');
            }
        });
    });

    // --- 最終クリーンアップと初期ロード ---
    loadSetlistState().then(() => {
        console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
        hideSetlistItemsInMenu(); // 初期ロード後にアルバムメニューの表示を更新
        // 初期ロード後、すべてのセットリストスロットのpointer-eventsを適切に設定
        document.querySelectorAll('.setlist-slot').forEach(slot => {
            if (slot.classList.contains('setlist-item')) {
                slot.style.pointerEvents = 'auto';
                slot.style.touchAction = 'pan-y';
            } else {
                slot.style.pointerEvents = 'none';
                slot.style.touchAction = 'none';
            }
        });
    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        hideSetlistItemsInMenu(); // エラー時もアルバムメニューの表示を更新
    });
});
