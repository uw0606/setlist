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

let currentTouchDraggedOriginalElement = null; // モバイルのタッチドラッグで元の要素を保持

// アルバム1として扱うdata-item-idのリスト（共有テキスト、PDF生成時に使用）
const album1ItemIds = [
    'album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006',
    'album1-007', 'album1-008', 'album1-009', 'album1-010', 'album1-011',
    'album1-012', 'album1-013'
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
        isCheckedShort = element.dataset.isShortVersion === 'true'; // クローンでは dataset.isShortVersion が現在の状態を示す
        isCheckedSe = element.dataset.hasSeOption === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloOption === 'true';
        
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
function clearSlotContent(slotElement) {
    // スロットが実際にコンテンツを持っているかを確認
    if (!slotElement.classList.contains('setlist-item')) {
        return; // 空のスロットであれば何もしないで終了
    }

    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }
    
    // アイテムを示すクラスとデータ属性を全て削除
    slotElement.classList.remove('setlist-item', 'item', 'album1', 'album2', 'album3', 'album4', 'album5', 'album6', 'album7', 'album8', 'album9', 'album10', 'album11', 'album12', 'album13', 'album14', 'short', 'se-active', 'drumsolo-active'); 
    
    // dataset をクリア
    for (const key in slotElement.dataset) {
        delete slotElement.dataset[key];
    }
    slotElement.dataset.slotIndex = slotElement.getAttribute('data-slot-index'); // slotIndexだけは残す

    // イベントリスナーの削除 (DOMContentLoadedで追加されたもの。handleSlotClickは削除済み)
    slotElement.removeEventListener('dblclick', handleDoubleClick);
    slotElement.removeEventListener('touchstart', handleTouchStart);
    slotElement.removeEventListener('touchend', handleTouchEnd);
    slotElement.removeEventListener('touchmove', handleTouchMove);
    
    // スロットをクリアしたら、pointer-eventsを 'none' に設定する
    slotElement.style.pointerEvents = 'none';
    slotElement.style.touchAction = 'none'; // touch-actionも無効にする
    
    console.log(`[clearSlotContent] Slot ${slotElement.dataset.slotIndex} cleared successfully.`);
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
        console.warn("[dragstart:PC] No draggable item found.");
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

    if (newDropZone && !(originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex)) {
        if (newDropZone !== currentDropZone) {
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            newDropZone.classList.add('drag-over');
            currentDropZone = newDropZone;
        }
    } else if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
    }
}

/**
 * ドロップ処理を実行する関数。
 * @param {HTMLElement} draggedElement - ドロップされた要素（クローンまたは元の要素）。
 * @param {HTMLElement} dropTargetSlot - ドロップされた先のセットリストスロット。
 * @param {HTMLElement | null} originalSourceSlot - 元のセットリストスロット（セットリスト内からのドラッグの場合）。
 */
function processDrop(draggedElement, dropTargetSlot, originalSourceSlot) {
    console.log("[processDrop] Initiated.");
    console.log("Dragged Element:", draggedElement);
    console.log("Drop Target Slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "N/A");
    console.log("Original Source Slot:", originalSourceSlot ? originalSourceSlot.dataset.slotIndex : "N/A");

    // 無効なドロップターゲットは無視
    if (!dropTargetSlot || !dropTargetSlot.classList.contains('setlist-slot')) {
        console.warn("[processDrop] Invalid drop target. Aborting.");
        showMessage("有効なドロップ位置ではありません。", "error");
        return;
    }

    // ドロップされたアイテムのデータを取得（クローンまたは元の要素から）
    const itemId = draggedElement.dataset.itemId;
    const songName = draggedElement.dataset.songName;
    const options = {
        isShortVersion: draggedElement.dataset.isShortVersion === 'true',
        hasSeOption: draggedElement.dataset.hasSeOption === 'true',
        drumsoloOption: draggedElement.dataset.drumsoloOption === 'true',
        rGt: draggedElement.dataset.rGt || '',
        lGt: draggedElement.dataset.lGt || '',
        bass: draggedElement.dataset.bass || '',
        bpm: draggedElement.dataset.bpm || '',
        chorus: draggedElement.dataset.chorus || 'false',
        // fillSlotWithItem と updateSlotContent が必要とする現在の状態も渡す
        short: draggedElement.dataset.short === 'true', 
        seChecked: draggedElement.dataset.seChecked === 'true',
        drumsoloChecked: draggedElement.dataset.drumsoloChecked === 'true'
    };
    
    // アルバムクラスを正確に取得する (draggedElementはクローンなので、元のクラスを保持しているはず)
    const albumClass = Array.from(draggedElement.classList).find(cls => cls.startsWith('album') && cls !== 'item');
    if (!albumClass) {
        console.warn("[processDrop] Could not find album class for dragged item:", draggedElement);
    }

    // 元のスロットとドロップ先が同じ場合（セットリスト内での自己ドロップ）
    if (originalSourceSlot && dropTargetSlot.dataset.slotIndex === originalSourceSlot.dataset.slotIndex) {
        console.log("[processDrop] Dropped back into the same slot. No change.");
        showMessage("同じ位置にドロップしました。", "info");
        return; // 何もせず終了
    }

    // 元のスロットが存在する場合（セットリスト内からの移動）
    if (originalSourceSlot) {
        console.log("[processDrop] Moving item within setlist.");
        // ドロップ先スロットに既にアイテムがあるか確認
        if (dropTargetSlot.classList.contains('setlist-item')) {
            // 入れ替え処理
            console.log(`[processDrop] Swapping item from slot ${originalSourceSlot.dataset.slotIndex} with item in slot ${dropTargetSlot.dataset.slotIndex}.`);
            
            // ドロップ先アイテムのデータを取得
            const targetSongData = getSlotItemData(dropTargetSlot); // getSlotItemData を使用して一貫性を保つ
            if (!targetSongData) {
                console.error("[processDrop] Failed to get data for target slot. Aborting swap.");
                showMessage("曲の入れ替えに失敗しました。", "error");
                return;
            }

            // 元のスロットにドロップ先アイテムを再配置
            clearSlotContent(originalSourceSlot); // 元のスロットをクリア
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
                drumsoloChecked: targetSongData.drumsoloChecked
            }, targetSongData.albumClass);

            // ドロップ先にドラッグされたアイテムを配置
            clearSlotContent(dropTargetSlot); // ドロップ先をクリア
            addSongToSlot(dropTargetSlot, itemId, songName, options, albumClass); // optionsはすでに適切な形式

            showMessage("セットリスト内の曲を移動しました。", "success");

        } else {
            // 空のスロットへの移動
            console.log(`[processDrop] Moving item from slot ${originalSourceSlot.dataset.slotIndex} to empty slot ${dropTargetSlot.dataset.slotIndex}.`);
            clearSlotContent(originalSourceSlot); // 元のスロットをクリア
            addSongToSlot(dropTargetSlot, itemId, songName, options, albumClass);
            showMessage("セットリスト内の曲を移動しました。", "success");
        }
    } else {
        // 元のスロットが存在しない場合（アルバムからの追加）
        console.log("[processDrop] Adding item from album to setlist.");
        if (dropTargetSlot.classList.contains('setlist-item')) {
            // 埋まっているスロットへのアルバムからのドロップは、現時点では許可しない
            showMessage("既に曲があるスロットには追加できません。", "error");
            console.warn("[processDrop] Cannot drop album item into an occupied setlist slot.");
            return;
        } else {
            // 空のスロットへのアルバムからのドロップ
            addSongToSlot(dropTargetSlot, itemId, songName, options, albumClass);
            showMessage("セットリストに曲を追加しました。", "success");
        }
    }
    // メニュー内の表示は finishDragging で更新されるのでここでは不要
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

        isDragging = false; // まだドラッグ開始ではない
        draggingItemId = touchedElement.dataset.itemId;

        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            currentTouchDraggedOriginalElement = touchedElement; 
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}`);
        } else {
            originalSetlistSlot = null; // アルバムからのドラッグ
            currentTouchDraggedOriginalElement = touchedElement; 
            currentPcDraggedElement = null; // PC用変数をリセット
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
            if (draggingItemId && document.body.contains(touchedElement)) {
                // ドラッグ開始時に元のアイテムを隠す
                if (currentTouchDraggedOriginalElement) {
                    if (originalSetlistSlot) { // セットリストアイテムの場合
                        originalSetlistSlot.classList.add('placeholder-slot');
                        originalSetlistSlot.style.visibility = 'hidden';
                        console.log(`[touchstart:Mobile] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} hidden and marked as placeholder.`);
                    } else { // アルバムアイテムの場合
                        currentTouchDraggedOriginalElement.style.visibility = 'hidden';
                        console.log(`[touchstart:Mobile] Original album item ${currentTouchDraggedOriginalElement.dataset.itemId} hidden.`);
                    }
                }
                
                // クローンを作成し、ドラッグ開始
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true; 
                console.log("[touchstart:Mobile] Dragging initiated after timeout.");

                // ドラッグ開始時にすべてのセットリストスロットをドロップ可能にする
                document.querySelectorAll('.setlist-slot').forEach(slot => {
                    slot.style.pointerEvents = 'auto'; // ドロップ可能にする
                });
            } else {
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout (element removed or ID missing).");
            }
            touchTimeout = null;
        }, 600); 
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
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
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
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

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
 * クローン要素作成（スマホ向けドラッグ開始時）
 * @param {Element} originalElement - 元の要素 (アルバムアイテムまたはセットリストアイテム)
 * @param {number} initialX - タッチ開始時のX座標
 * @param {number} initialY - タッチ開始時のY座標
 * @param {string} itemIdToClone - クローンするアイテムのID
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    if (currentTouchDraggedClone) { // 既存のクローンがあれば削除
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body. Aborting clone creation.");
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // 元の要素からデータ属性を全てコピーする
    // これにより、getSlotItemDataやprocessDropで正しくデータを取得できる
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; // 念のためitemIdを再設定

    document.body.appendChild(currentTouchDraggedClone);

    // 元のリストの記録（既に存在する場合は更新しない）
    if (!originalAlbumMap.has(itemIdToClone)) {
        originalAlbumMap.set(itemIdToClone, originalElement.parentNode ? originalElement.parentNode.id : null);
    }

    // クローンの位置とスタイル設定
    const rect = originalElement.getBoundingClientRect();
    Object.assign(currentTouchDraggedClone.style, {
        position: 'fixed',
        zIndex: '10000',
        width: rect.width + 'px',
        height: rect.height + 'px',
        left: (initialX - rect.width / 2) + 'px', // タッチした場所を中心にする
        top: (initialY - rect.height / 2) + 'px',  // タッチした場所を中心にする
        pointerEvents: 'none' // クローンが下の要素のイベントをブロックしないように
    });
    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone} at (${currentTouchDraggedClone.style.left}, ${currentTouchDraggedClone.style.top})`);
}

/**
 * ドラッグ&ドロップの終了処理をまとめた関数。
 * @param {boolean} [isCancelled=false] - ドラッグがキャンセルされたかどうか。
 */
function finishDragging(isCancelled = false) {
    console.log("[finishDragging] Cleaning up dragging state. Cancelled:", isCancelled);

    // クローン要素の削除
    if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode) {
        currentTouchDraggedClone.parentNode.removeChild(currentTouchDraggedClone);
        currentTouchDraggedClone = null;
    }

    // PCドラッグ中の要素のクラスと参照をリセット
    if (currentPcDraggedElement) {
        currentPcDraggedElement.classList.remove('dragging');
        currentPcDraggedElement = null;
    }

    // 元の要素のvisibilityを元に戻す
    if (originalSetlistSlot) {
        originalSetlistSlot.classList.remove('placeholder-slot');
        originalSetlistSlot.style.visibility = ''; // CSSで設定したvisibilityに戻す
        originalSetlistSlot = null;
    } else if (currentTouchDraggedOriginalElement) {
        // アルバムアイテムの場合もスタイルを元に戻す
        currentTouchDraggedOriginalElement.style.visibility = '';
        currentTouchDraggedOriginalElement = null;
    }

    // ドラッグオーバーのハイライトをすべて解除
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
    });

    // ドラッグ終了時にすべてのセットリストスロットのpointer-eventsをリセットする
    // 空のスロットは pointer-events: none; に、アイテムが入っているスロットは pointer-events: auto; に戻す
    document.querySelectorAll('.setlist-slot').forEach(slot => {
        if (slot.classList.contains('setlist-item')) {
            slot.style.pointerEvents = 'auto'; // 曲が入っているスロットはイベントを許可
            slot.style.touchAction = 'pan-y'; // タッチスクロールも許可
        } else {
            slot.style.pointerEvents = 'none'; // 空のスロットはイベントをブロック
            slot.style.touchAction = 'none'; // touch-actionも無効にする
        }
    });

    // ドラッグ関連のグローバル変数をリセット
    isDragging = false;
    draggingItemId = null;
    touchStartX = 0;
    touchStartY = 0;

    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
    
    // アルバムメニュー内のセットリストアイテムの表示/非表示を更新
    hideSetlistItemsInMenu();
    console.log("[finishDragging] Dragging state cleaned up.");
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
 * - `drumsoloOption`: ドラムソロオプションが「存在しうるか」 (boolean)
 * - `rGt`, `lGt`, `bass`, `bpm`: チューニングやBPMの文字列
 * - `chorus`: コーラス情報 ('true'/'false'文字列)
 * - `short`: 短縮版が「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `seChecked`: SEが「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `drumsoloChecked`: ドラムソロが「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * @param {string} albumClass - 曲が属するアルバムのクラス名 (例: 'album1', 'album2')。
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
    slotElement.dataset.isShortVersion = options.isShortVersion ? 'true' : 'false';
    slotElement.dataset.hasSeOption = options.hasSeOption ? 'true' : 'false';
    slotElement.dataset.drumsoloOption = options.drumsoloOption ? 'true' : 'false';
    
    // チューニングやBPMは文字列としてそのまま保存
    slotElement.dataset.rGt = options.rGt || ''; 
    slotElement.dataset.lGt = options.lGt || '';
    slotElement.dataset.bass = options.bass || '';
    slotElement.dataset.bpm = options.bpm || '';
    slotElement.dataset.chorus = options.chorus || 'false'; // 'true'/'false'文字列を期待

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

    // スロットの pointer-events を 'auto' に設定（これでタップ・ドラッグ可能になる）
    slotElement.style.pointerEvents = 'auto';
    slotElement.style.touchAction = 'pan-y'; // タッチスクロールを許可

    // ここで直接イベントリスナーを再設定するのではなく、
    // enableDragAndDropが要素に追加されるか、既存のリスナーが動作することを期待する
    // clearSlotContentで削除済みなので、DOMContentLoadedのenableDragAndDropが動的に追加された要素に対して
    // 確実に再度呼ばれるか、またはイベント委譲で対応する必要がある
    // 今回はDOMContentLoadedで全てのsetlist-slotに対してenableDragAndDropを呼んでいるため、
    // ここでの再追加は基本的に不要（二重登録になる）
    // もし動的にスロットを追加するようなケースがある場合は、その場所でenableDragAndDropを呼ぶべき

    // スロットのコンテンツを更新（曲名やオプションの表示）
    // updateSlotContent には options オブジェクトをそのまま渡す
    updateSlotContent(slotElement, songName, options);

    console.log(`[addSongToSlot] Successfully added song ${songName} to slot ${slotElement.dataset.slotIndex}.`);
}


// =============================================================================
// イベントリスナーの登録と初期化
// =============================================================================

/**
 * ドラッグ＆ドロップとダブルクリックを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // 既存のリスナーを削除してから追加することで、二重登録を防ぐ（ただし、パフォーマンスへの影響を考慮）
    // または、イベント委譲を使用する方が一般的には推奨されるが、ここでは直接リスナーを管理する
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
    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        hideSetlistItemsInMenu(); // エラー時もアルバムメニューの表示を更新
    });
});