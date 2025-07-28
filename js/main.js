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
    const isAlbumItem = element.classList.contains('item') && !isSetlistItem;

    let songName = '';
    let isCheckedShort = false;
    let isCheckedSe = false;
    let isCheckedDrumsolo = false;
    let hasShortOption = false;
    let hasSeOption = false;
    let hasDrumsoloOption = false;
    let albumClass = Array.from(element.classList).find(className => className.startsWith('album'));
    let itemId = element.dataset.itemId;

    let rGt = element.dataset.rGt || '';
    let lGt = element.dataset.lGt || '';
    let bass = element.dataset.bass || '';
    let bpm = element.dataset.bpm || '';
    let chorus = element.dataset.chorus || '';

    if (isSetlistItem) {
        const songInfo = element.querySelector('.song-info-container .song-name-and-option'); // より具体的に
        songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : element.dataset.songName;

        isCheckedShort = element.querySelector('input[type="checkbox"][data-option-type="short"]')?.checked || false;
        isCheckedSe = element.querySelector('input[type="checkbox"][data-option-type="se"]')?.checked || false;
        isCheckedDrumsolo = element.querySelector('input[type="checkbox"][data-option-type="drumsolo"]')?.checked || false;

        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';
    } else if (isAlbumItem) {
        songName = element.dataset.songName || element.textContent.trim();
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';
    } else if (element.dataset.itemId) { // クローン要素などの場合
        songName = element.dataset.songName;
        isCheckedShort = element.dataset.short === 'true';
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';
        
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';
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
        chorus: chorus
    };
}

/**
 * 指定されたセットリストのスロットからアイテムをクリアする。
 * @param {HTMLElement} slotElement - クリアするセットリストのスロット要素。
 */
function clearSlotContent(slotElement) {
    console.log("[clearSlotContent] Clearing slot:", slotElement.dataset.slotIndex);

    // ★修正点3: スロットが実際にコンテンツを持っているかを確認
    if (!slotElement.classList.contains('setlist-item')) {
        console.warn(`[clearSlotContent] Attempted to clear an empty slot: ${slotElement.dataset.slotIndex}. No action taken.`);
        return; // 空のスロットであれば何もしないで終了
    }

    // slotElement.innerHTML = '';
    // slotElement.textContent = ''; // テキストコンテンツも確実にクリア
    // 上記の代わりに、子要素を全て削除する
    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }
    
    slotElement.classList.remove('setlist-item', 'item', 'album1', 'album2', 'album3'); // アイテムを示すクラスを全て削除
    slotElement.removeAttribute('data-item-id');
    slotElement.removeAttribute('data-song-name');
    slotElement.removeAttribute('data-is-short-version');
    slotElement.removeAttribute('data-has-se-option');
    slotElement.removeAttribute('data-has-drumsolo-option');
    slotElement.removeAttribute('data-r-gt');
    slotElement.removeAttribute('data-l-gt');
    slotElement.removeAttribute('data-bass');
    slotElement.removeAttribute('data-bpm');
    slotElement.removeAttribute('data-chorus'); // 必要に応じて他のdata属性も削除

    // オプション要素があれば削除
    const optionsDiv = slotElement.querySelector('.item-options');
    if (optionsDiv) {
        optionsDiv.remove();
    }
    
    // イベントリスナーの削除 (以前 attachSlotEvents で追加したものを逆順で削除)
    slotElement.removeEventListener('click', handleSlotClick);
    slotElement.removeEventListener('dblclick', handleDoubleClick); // Double click event
    slotElement.removeEventListener('touchstart', handleTouchStart); // Mobile touch events
    slotElement.removeEventListener('touchend', handleTouchEnd);
    slotElement.removeEventListener('touchmove', handleTouchMove);
    
    console.log(`[clearSlotContent] Slot ${slotElement.dataset.slotIndex} cleared successfully.`);
}



/**
 * アイテムを元のアルバムリストに戻し、セットリストから削除する。
 * @param {object} itemData - 戻すアイテムのデータオブジェクト (itemId を含む)
 */
function restoreToOriginalList(itemData) { // ★修正点9: 引数を itemData に変更
    const itemId = itemData.itemId; // itemData から itemId を取得
    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found in itemData for restoration. ItemData:`, itemData);
        return;
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}.`);

    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.visibility = ''; // アルバム内のアイテムを可視に戻す
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // セットリストから該当アイテムをクリアする
    const slotToClearInSetlist = setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${itemId}"]`);
    if (slotToClearInSetlist) {
        console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotToClearInSetlist.dataset.slotIndex}`);
        clearSlotContent(setlist, slotToClearInSetlist.dataset.slotIndex);
    } else {
        console.log(`[restoreToOriginalList] Item ${itemId} was not in setlist (or slot not found), no slot to clear.`);
    }

    if (originalAlbumMap.has(itemId)) {
        originalAlbumMap.delete(itemId);
        console.log(`[restoreToOriginalList] Deleted ${itemId} from originalAlbumMap.`);
    }
}



/**
 * カスタムメッセージボックスを表示する関数 (alertの代替)。
 * @param {string} message - 表示するメッセージ
 */
function showMessageBox(message) {
    let messageBox = document.getElementById('customMessageBox');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'customMessageBox';
        document.body.appendChild(messageBox);
    }
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
    console.log(`[showMessageBox] Displaying message: "${message}"`);
}

/**
 * セットリスト内のアイテムをアルバムメニューから非表示にする。
 * この関数は、loadSetlistStateの完了後、または通常読み込み時に呼び出される。
 */
function hideSetlistItemsInMenu() {
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");
    // まずすべてのアルバムアイテムを可視状態に戻す（念のため）
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.visibility = '';
    });

    const currentSetlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    if (currentSetlistItems.length === 0) {
        console.log("[hideSetlistItemsInMenu] Setlist is empty, no items to hide.");
        return;
    }

    currentSetlistItems.forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItemInMenu) {
                albumItemInMenu.style.visibility = 'hidden';
                console.log(`[hideSetlistItemsInMenu] HIDDEN: Album item in menu: ${itemId}`);
            } else {
                console.warn(`[hideSetlistItemsInMenu] WARNING: Album item for ID: ${itemId} not found in menu to hide.`);
            }
        }
    });
    console.log("[hideSetlistItemsInMenu] END: Finished hiding setlist items in album menu.");
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
            if (songData.rGt) tunings.push(`R.Gt:${songData.rGt}`);
            if (songData.lGt) tunings.push(`L.Gt:${songData.lGt}`);
            if (songData.bass) tunings.push(`Bass:${songData.bass}`);
            if (tunings.length > 0) line += ` (${tunings.join(' ')})`;

            if (songData.bpm) line += ` (BPM:${songData.bpm})`;
            if (songData.chorus) line += ` (C:${songData.chorus})`;
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

    let songInfoContainer = slotElement.querySelector('.song-info-container');
    if (!songInfoContainer) {
        songInfoContainer = document.createElement('div');
        songInfoContainer.classList.add('song-info-container');
        slotElement.appendChild(songInfoContainer);
    }
    songInfoContainer.innerHTML = ''; // 既存の内容をクリア

    // クラスのクリーンアップ
    Array.from(slotElement.classList).forEach(cls => {
        if (cls.startsWith('album') || ['setlist-item', 'item', 'short', 'se-active', 'drumsolo-active'].includes(cls)) {
            slotElement.classList.remove(cls);
        }
    });

    // --- 曲名とオプション（Short/SE/ドラムソロ）部分 ---
    const songNameAndOptionDiv = document.createElement('div');
    songNameAndOptionDiv.classList.add('song-name-and-option');

    songNameAndOptionDiv.appendChild(document.createTextNode(songData.name));

    const addCheckboxOption = (type, labelText, isChecked, hasOption, parentDiv) => {
        if (hasOption) {
            const wrapper = document.createElement('span');
            wrapper.classList.add('checkbox-wrapper');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isChecked;
            checkbox.dataset.optionType = type;
            wrapper.appendChild(checkbox);
            const label = document.createElement('span');
            label.textContent = labelText;
            label.classList.add(`${type}-label`);
            wrapper.appendChild(label);
            parentDiv.appendChild(wrapper);
        }
    };

    addCheckboxOption('short', '(Short)', songData.short, songData.hasShortOption, songNameAndOptionDiv);
    addCheckboxOption('se', '(SE有り)', songData.seChecked, songData.hasSeOption, songNameAndOptionDiv);
    addCheckboxOption('drumsolo', '(ドラムソロ有り)', songData.drumsoloChecked, songData.hasDrumsoloOption, songNameAndOptionDiv);

    // --- チューニング、BPM、コーラス情報の表示 ---
    const additionalInfoDiv = document.createElement('div');
    additionalInfoDiv.classList.add('additional-song-info');
    const infoParts = [];
    if (songData.rGt || songData.lGt || songData.bass) {
        infoParts.push(`A.Gt（${songData.rGt||''}） K.Gt（${songData.lGt||''}） B（${songData.bass||''}）`);
    }
    if (songData.bpm) infoParts.push(`BPM:${songData.bpm}`);
    if (songData.chorus) infoParts.push(`コーラス:${songData.chorus}`);

    if (infoParts.length > 0) {
        additionalInfoDiv.textContent = infoParts.join(' | ');
    } else {
        additionalInfoDiv.style.display = 'none';
    }

    songInfoContainer.appendChild(songNameAndOptionDiv);
    songInfoContainer.appendChild(additionalInfoDiv);

    // クラスとデータ属性の設定
    slotElement.classList.toggle('short', songData.short);
    slotElement.dataset.short = songData.short ? 'true' : 'false';
    slotElement.classList.toggle('se-active', songData.seChecked);
    slotElement.dataset.seChecked = songData.seChecked ? 'true' : 'false';
    slotElement.classList.toggle('drumsolo-active', songData.drumsoloChecked);
    slotElement.dataset.drumsoloChecked = songData.drumsoloChecked ? 'true' : 'false';

    slotElement.classList.add('setlist-item', 'item');
    if (songData.albumClass) {
        slotElement.classList.add(songData.albumClass);
    }

    slotElement.dataset.itemId = songData.itemId;
    slotElement.dataset.songName = songData.name;
    slotElement.dataset.isShortVersion = songData.hasShortOption ? 'true' : 'false';
    slotElement.dataset.hasSeOption = songData.hasSeOption ? 'true' : 'false';
    slotElement.dataset.hasDrumsoloOption = songData.hasDrumsoloOption ? 'true' : 'false';

    slotElement.dataset.rGt = songData.rGt || '';
    slotElement.dataset.lGt = songData.lGt || '';
    slotElement.dataset.bass = songData.bass || '';
    slotElement.dataset.bpm = songData.bpm || '';
    slotElement.dataset.chorus = songData.chorus || '';

    // イベントリスナーを再アタッチ（draggableはenableDragAndDropで設定済みだが念のため）
    slotElement.draggable = true;
    slotElement.addEventListener("dragstart", handleDragStart);
    slotElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    slotElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    slotElement.addEventListener("touchend", handleTouchEnd);
    slotElement.addEventListener("touchcancel", handleTouchEnd);

    console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and events re-attached.`);
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
        return;
    }

    draggingItemId = originalElement.dataset.itemId;
    event.dataTransfer.setData("text/plain", draggingItemId);
    event.dataTransfer.effectAllowed = "move";

    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot); // 移動元データの保存
        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot');
        currentPcDraggedElement = originalElement;
        console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
    } else {
        originalSetlistSlot = null;
        currentPcDraggedElement = originalElement;
        console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the currentPcDraggedElement.`);
    }

    // 元のアルバムリスト情報を記録
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
        console.log(`[dragenter] Entered slot: ${targetSlot.dataset.slotIndex}`);
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
            console.log(`[dragleave] Left slot: ${targetSlot.dataset.slotIndex}`);
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
 * ドロップされたアイテムを処理し、セットリストに反映する。
 * @param {HTMLElement} draggedElement - ドラッグされたアイテムのクローン要素
 * @param {HTMLElement|null} dropTargetSlot - ドロップされたセットリストのスロット要素、またはnull（セットリスト外にドロップ）
 * @param {HTMLElement|null} originalSetlistSlot - ドラッグ元がセットリストだった場合のスロット要素、またはnull
 */
function processDrop(draggedElement, dropTargetSlot, originalSetlistSlot) {
    console.log("[processDrop] Initiated. draggedElement:", draggedElement, "dropTargetSlot:", dropTargetSlot, "originalSetlistSlot:", originalSetlistSlot);

    const isDraggedFromSetlist = !!originalSetlistSlot;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    const draggedItemId = draggedElement.dataset.itemId;
    const songData = getSlotItemData(draggedElement); // ドラッグされたアイテムのデータを取得

    if (!songData) {
        console.error("[processDrop] No song data found for dragged element:", draggedElement);
        // ここで元のアイテムの表示を戻すなど、エラーハンドリングが必要かもしれない
        return;
    }

    // ★★★ 重要な修正点1: アルバムからのドラッグで、セットリスト外にドロップされた場合 ★★★
    if (!isDraggedFromSetlist && !dropTargetSlot) {
        console.log("[processDrop] Item dragged from album and dropped outside setlist. Restoring to original list.");
        restoreToOriginalList(songData); // これはドラッグキャンセル時に元のアルバムアイテムを表示する処理
        return;
    }

    // ★★★ 重要な修正点2: ドラッグターゲットがセットリストのスロットではない場合（念のため） ★★★
    if (!dropTargetSlot || !setlist.contains(dropTargetSlot)) {
        console.warn("[processDrop] Drop target is not a valid setlist slot. Restoring original item visibility.");
        if (!isDraggedFromSetlist) { // アルバムからのドラッグの場合のみ元のアイテムを戻す
            restoreToOriginalList(songData);
        }
        return;
    }
    
    // ★★★ 重要な修正点3: 空のスロットがドロップターゲットの場合の処理を厳密化 ★★★
    // アルバムからのドラッグで、空のスロットにドロップされた場合のみ処理を続行
    if (!isDraggedFromSetlist && !dropTargetSlot.classList.contains('setlist-item')) {
        console.log(`[processDrop] Adding item from album to empty slot. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
        fillSlotWithItem(dropTargetSlot, songData);
        hideSetlistItemsInMenu(); // アルバムメニューから非表示にする
        return; // ここで処理を終了
    }

    // ★★★ 重要な修正点4: 既に曲が入っているスロットにドロップされた場合（入れ替え処理） ★★★
    if (dropTargetSlot.classList.contains('setlist-item')) {
        // 同じスロットにドロップされた場合、何もしない
        if (isDraggedFromSetlist && dropTargetSlot === originalSetlistSlot) {
            console.log("[processDrop] Dropped onto same slot. No change.");
            // 元のスロットのplaceholderクラスとvisibilityをfinishDraggingで戻すので、ここでは何もしない
            return;
        }

        const dropTargetItemData = getSlotItemData(dropTargetSlot);

        if (isDraggedFromSetlist) {
            // セットリスト内でのアイテムの入れ替え
            console.log(`[processDrop] Swapping items. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);

            // ターゲットスロットの内容をクリア
            clearSlotContent(dropTargetSlot);
            // 元のスロットの内容をクリア (後でドラッグ元の曲で埋めるため)
            clearSlotContent(originalSetlistSlot);

            // ターゲットスロットに元のスロットのアイテムをセット
            if (originalSetlistSlot._originalItemData) {
                fillSlotWithItem(dropTargetSlot, originalSetlistSlot._originalItemData);
            } else {
                console.error("[processDrop] No original item data for swapping.");
            }
            
            // 元のスロットにターゲットスロットのアイテムをセット
            if (dropTargetItemData) {
                fillSlotWithItem(originalSetlistSlot, dropTargetItemData);
            } else {
                // ドロップターゲットが空だった場合（本来ありえないが念のため）
                console.warn("[processDrop] Drop target slot was unexpectedly empty during swap.");
            }
            // 入れ替えなのでメニューの表示・非表示は変更なし
        } else {
            // アルバムからのドラッグで、セットリストの既存の曲と入れ替える
            console.log(`[processDrop] Replacing item in slot: ${dropTargetSlot.dataset.slotIndex} with item from album.`);
            
            // 既存の曲をアルバムに戻す
            restoreToOriginalList(dropTargetItemData);

            // ターゲットスロットの内容をクリア
            clearSlotContent(dropTargetSlot);
            
            // 新しい曲をターゲットスロットにセット
            fillSlotWithItem(dropTargetSlot, songData);
            hideSetlistItemsInMenu(); // アルバムメニューから非表示にする
        }
        return;
    }

    // ★★★ 重要な修正点5: その他の不測の事態（通常ここに到達しないはず） ★★★
    console.warn("[processDrop] Unexpected drop scenario. Attempting to restore original item.", { draggedElement, dropTargetSlot, originalSetlistSlot });
    if (!isDraggedFromSetlist) { // アルバムからのドラッグで、予期せぬ場所にドロップされた場合
        restoreToOriginalList(songData);
    }
}



/**
 * ドロップ時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
    event.preventDefault();
    console.log("[handleDrop] Drop event fired.");
    const droppedItemId = event.dataTransfer.getData("text/plain");
    console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

    let draggedItem = originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId ?
        originalSetlistSlot :
        document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);

    if (!draggedItem) {
        console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". Aborting.");
        finishDragging();
        return;
    }
    console.log("[handleDrop] draggedItem found:", draggedItem);

    const dropTargetSlot = event.target.closest('.setlist-slot');
    console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
    finishDragging();
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
        lastTapTime = 0;
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
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime;

    if (event.touches.length === 1) {
        const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item") || event.target.closest(".setlist-slot"); // ★修正点1: 空のスロットも対象に含める
        
        if (!touchedElement) {
            console.warn("[touchstart:Mobile] No draggable or setlist item found on touch start.");
            return;
        }
        console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedElement);

        // ★修正点2: 空のセットリストスロットを長押しした場合の早期リターン
        // ドラッグ開始タイマーを設定する前にチェック
        if (touchedElement.classList.contains('setlist-slot') && !touchedElement.classList.contains('setlist-item')) {
            // これは空のセットリストスロットに対するタップ/長押し
            console.log("[touchstart:Mobile] Touched an EMPTY setlist slot. Allowing native behavior but preventing drag initiation.");
            clearTimeout(touchTimeout); // 念のためタイマーをクリア
            touchTimeout = null;
            isDragging = false;
            // ここで preventDefault を呼ばないことで、ブラウザのデフォルトの振る舞い（スクロールなど）を許可する。
            // これにより、空のスペースでの意図しないドラッグや要素のクリアを防ぐ。
            return; // 処理をここで終了
        }
        
        // 通常のドラッグ開始ロジック（ここから下は、曲があるスロットまたはアルバムアイテムに触れた場合のみ実行される）
        isDragging = false; 
        draggingItemId = touchedElement.dataset.itemId;

        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
            currentTouchDraggedOriginalElement = touchedElement; 
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
        } else {
            originalSetlistSlot = null; 
            currentTouchDraggedOriginalElement = touchedElement; 
            currentPcDraggedElement = null; 
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
            if (draggingItemId && document.body.contains(touchedElement)) {
                // ドラッグ開始時に元のアイテムを隠す
                if (currentTouchDraggedOriginalElement) {
                    if (originalSetlistSlot) {
                        originalSetlistSlot.classList.add('placeholder-slot');
                        originalSetlistSlot.style.visibility = 'hidden';
                        console.log(`[touchstart:Mobile] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} hidden and marked as placeholder.`);
                    } else {
                        currentTouchDraggedOriginalElement.style.visibility = 'hidden';
                        console.log(`[touchstart:Mobile] Original album item ${currentTouchDraggedOriginalElement.dataset.itemId} hidden.`);
                    }
                }
                
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true; 
                console.log("[touchstart:Mobile] Dragging initiated after timeout.");
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
    // ドラッグがまだ開始されていない状態で指が大きく動いたら、長押しをキャンセル
    // これにより、スクロールはブロックされない
    if (!isDragging && touchTimeout) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);
        const threshold = 10; // 10px以上動いたらキャンセル

        if (deltaX > threshold || deltaY > threshold) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
            // ★修正点2: 長押しキャンセル時、元のアイテムの表示を戻す
            if (currentTouchDraggedOriginalElement) {
                currentTouchDraggedOriginalElement.style.visibility = 'visible';
                currentTouchDraggedOriginalElement = null; // リセット
            }
            console.log("[handleTouchMove] Touch moved too much before drag started. Long press cancelled, allowing scroll.");
            return; // ここでリターンすることで、preventDefaultが呼ばれず、スクロールが許可される
        }
    }

    // ★修正点3: isDraggingがtrueの場合のみpreventDefaultを呼び出す
    if (isDragging) {
        event.preventDefault(); // ドラッグ中はスクロールを防止
    } else {
        return; // ドラッグ中でなければ何もしない（スクロールを許可）
    }

    if (!isDragging || !currentTouchDraggedClone) return;

    if (rafId !== null) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
        if (!currentTouchDraggedClone) { rafId = null; return; }
        const touch = event.touches[0];
        const newX = touch.clientX;
        const newY = touch.clientY;

        const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
        currentTouchDraggedClone.style.left = (newX - cloneRect.width / 2) + 'px';
        currentTouchDraggedClone.style.top = (newY - cloneRect.height / 2) + 'px';

        const targetElement = document.elementFromPoint(newX, newY);
        const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

        if (originalSetlistSlot && newDropZone && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            // 元のスロットの上にいる場合はハイライトしない
            if (currentDropZone) currentDropZone.classList.remove('drag-over');
            currentDropZone = null;
        } else if (newDropZone !== currentDropZone) {
            if (currentDropZone) currentDropZone.classList.remove('drag-over');
            if (newDropZone) newDropZone.classList.add('drag-over');
            currentDropZone = newDropZone;
        }
        rafId = null;
    });
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
    const potentialDropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    // ★★★ 重要な修正点1: ドラッグが開始されていて、かつ指の移動が最小限だった場合（長押しタップ） ★★★
    if (isDragging && (deltaX < dragThreshold && deltaY < dragThreshold)) {
        console.log("[touchend] Drag initiated but finger moved minimally. Treating as long-press tap.");

        // ★★★ 重要な修正点2: 長押しタップが「空のセットリストスロット」上で発生した場合 ★★★
        if (potentialDropTargetSlot && !potentialDropTargetSlot.classList.contains('setlist-item')) {
            console.log("[touchend] Long-press tap on an EMPTY setlist slot. Ignoring to prevent accidental deletion.");
            // このケースでは、いかなるドロップ処理も行わず、ただクリーンアップする
            // isDragging は finishDragging 内部でリセットされるので、ここでは特に変更しない
            finishDragging(true); // キャンセルされたドラッグとしてクリーンアップ
            event.preventDefault(); // デフォルト動作を防止
            return; // ここで処理を完全に中断
        }
        
        // ★★★ 重要な修正点3: 長押しタップが「曲が入っているスロット」や「アルバムアイテム」上で発生した場合 ★★★
        console.log("[touchend] Long-press tap on a FILLED setlist slot or album item. Performing cleanup only.");
        // このケースも、ドロップ処理は行わず、ただクリーンアップする
        finishDragging(true); // クリーンアップのみ
        event.preventDefault(); // デフォルト動作を防止
        return;
    }

    // ★★★ 重要な修正点4: isDragging が false の場合（ロングプレスにならなかった単なるタップなど） ★★★
    if (!isDragging) {
        if (event.target.closest('input[type="checkbox"]')) {
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        } else {
            console.log("[touchend] Not dragging. No action taken.");
        }
        // ここでは event.preventDefault() を呼ばない。スクロールなどが既に許可されているため。
        return;
    }

    // ★★★ 重要な修正点5: ここから下は、実際に「ドラッグ（指の移動あり）」が検出された場合の処理 ★★★
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. Aborting.");
        finishDragging(true); // キャンセル扱いとしてクリーンアップ
        return;
    }

    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));

    const dropTargetSlot = potentialDropTargetSlot;
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (dropped outside setlist)");

    // ★★★ 重要な修正点6: processDrop を呼び出す前に、ドロップターゲットとドラッグ元の妥当性を厳密に確認 ★★★
    if (dropTargetSlot) {
        if (!originalSetlistSlot && !dropTargetSlot.classList.contains('setlist-item')) {
            // シナリオ1: アルバムからのドラッグで、空のスロットにドロップする場合
            console.log("[touchend] Valid drop: Album item to empty slot.");
            processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
            finishDragging(); 
            return;
        } else if (originalSetlistSlot) {
            // シナリオ2: セットリスト内でのドラッグ（入れ替え、または同じ場所へのドロップ）
            console.log("[touchend] Valid drop: Setlist item within setlist.");
            processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
            finishDragging(); 
            return;
        }
    } 
    
    // シナリオ3: セットリスト外へのドロップ、または無効なドロップ（長押しタップがここに到達した場合を含む）
    console.log("[touchend] Invalid drop scenario or dropped outside setlist. Performing cleanup as cancelled.");
    finishDragging(true); // キャンセル扱いとしてクリーンアップ
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
        console.warn("[createTouchDraggedClone] Original element not valid or not in body.");
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // クラスとデータ属性のコピー
    ['short', 'se-active', 'drumsolo-active'].forEach(cls => {
        if (originalElement.classList.contains(cls)) {
            currentTouchDraggedClone.classList.add(cls);
        }
    });
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone;

    document.body.appendChild(currentTouchDraggedClone);

    // 元の要素の処理 (セットリストかアルバムかで分岐)
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalElement);
        originalSetlistSlot.classList.add('placeholder-slot');
        originalElement.style.visibility = 'hidden'; // ★修正点2: 元の要素を隠す
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else { // アルバムからのドラッグ
        originalElement.style.visibility = 'hidden'; // ★修正点3: 元のアルバムアイテムを隠す
        originalSetlistSlot = null; // アルバムからのドラッグなのでリセット
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

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
        left: (initialX - rect.width / 2) + 'px',
        top: (initialY - rect.height / 2) + 'px',
        pointerEvents: 'none' // クローンが下の要素のイベントをブロックしないように
    });
    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}



/**
 * ドラッグ&ドロップ操作の最終処理。
 * @param {boolean} [cancelled=false] - ドラッグがキャンセルされたかどうか
 */
function finishDragging(cancelled = false) {
    console.log("[finishDragging] Initiating drag operation finalization. Cancelled:", cancelled);

    // ドラッグ中のクローン要素があれば削除
    if (currentTouchDraggedClone && document.body.contains(currentTouchDraggedClone)) {
        currentTouchDraggedClone.remove();
        console.log("[finishDragging] Removed currentTouchDraggedClone (mobile clone) from body.");
    }
    currentTouchDraggedClone = null;

    // PCドラッグの元の要素のvisibilityを戻す（PCドラッグの場合のみ）
    // originalSetlistSlotがnull && currentPcDraggedElementがある場合がアルバムからのPCドラッグ
    if (currentPcDraggedElement && !originalSetlistSlot) {
        currentPcDraggedElement.style.visibility = 'visible';
        console.log("[finishDragging] Restored visibility for PC album item:", currentPcDraggedElement.dataset.itemId);
    }
    currentPcDraggedElement = null; // 常にリセット

    // ★修正点6: モバイルタッチドラッグの元のアルバムアイテムのvisibilityを適切に戻す
    if (currentTouchDraggedOriginalElement) {
        // セットリストからのドラッグ（originalSetlistSlotが設定されている）の場合
        if (originalSetlistSlot && originalSetlistSlot.classList.contains('placeholder-slot')) {
            // 元のスロットのplaceholderクラスを削除し、visibilityをリセット
            originalSetlistSlot.classList.remove('placeholder-slot');
            originalSetlistSlot.style.visibility = ''; // visibility をリセット
            console.log(`[finishDragging] Restored visibility for originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex}.`);
        } else if (!originalSetlistSlot && cancelled) { // アルバムアイテムからのドラッグで、キャンセルされた場合のみ表示を戻す
            // アルバムアイテムからのドラッグで、セットリストにドロップされなかった（キャンセル扱い）場合は表示を戻す
            // ドロップされた場合は、hideSetlistItemsInMenu()が処理するのでここでは何もしない
            currentTouchDraggedOriginalElement.style.visibility = 'visible';
            console.log("[finishDragging] Restored visibility for mobile album item (cancelled drag):", currentTouchDraggedOriginalElement.dataset.itemId);
        }
        currentTouchDraggedOriginalElement = null; // リセット
    }
    
    originalSetlistSlot = null; // 常にリセット

    // ハイライトされていたスロットがあれば解除
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));
    console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

    // グローバルドラッグ状態をリセット
    isDragging = false;
    draggingItemId = null;
    touchStartX = 0;
    touchStartY = 0;
    currentDropZone = null;
    rafId = null; // requestAnimationFrame IDをリセット

    console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
}





/**
 * ダブルクリック（ダブルタップ）時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDoubleClick(event) {
    const item = event.target.closest(".item") || event.target.closest(".setlist-slot.setlist-item");
    if (!item) {
        console.log("[handleDoubleClick] No item found for double click.");
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

    const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

    if (isInsideSetlist) {
        console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
        // ★修正点4: セットリストからのダブルクリックで戻す際に、itemDataを正しく渡す
        const itemData = getSlotItemData(item);
        if (itemData) {
            restoreToOriginalList(itemData);
        } else {
            console.error("[handleDoubleClick] Could not get item data for double clicked setlist item to restore.");
        }
    } else { // アルバムからの追加
        console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
        const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));

        if (!emptySlot) {
            showMessageBox('セットリストは最大曲数に達しています。');
            console.log("[handleDoubleClick] Setlist is full.");
            return;
        }
        if (setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
            showMessageBox('この曲はすでにセットリストにあります。');
            console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist.`);
            return;
        }

        if (!originalAlbumMap.has(item.dataset.itemId)) {
            const originalList = item.parentNode;
            originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null);
            console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
        }

        item.style.visibility = 'hidden';
        console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

        const itemData = getSlotItemData(item);
        if (itemData) {
            fillSlotWithItem(emptySlot, itemData);
            console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
        } else {
            console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
        }
    }
    hideSetlistItemsInMenu();
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
    showMessageBox("PDFを生成中...");
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

            const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

            // 詳細PDF用の行
            const detailedRowNo = isAlbum1 ? '' : (currentItemNoDetailed++).toString();
            tableBody.push([
                detailedRowNo, titleText, songData.rGt || '', songData.lGt || '',
                songData.bass || '', songData.bpm || '', songData.chorus || ''
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
                tableBody.push([textContent, '', '', '', '', '', '']);
                simplePdfBody.push(textContent);
                shareableTextContent += `${textContent}\n`;
            }
        }
    }

    console.log("[generateSetlistPdf] Generated Shareable Text:\n", shareableTextContent);

    try {
        const { jsPDF } = window.jspdf;
        // registerJapaneseFont 関数は別途定義されている必要があります
        // 例: (function(jsPDFAPI) { ... })(window.jspdf.API);

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

        await new Promise(resolve => setTimeout(resolve, 500)); // 少し待機

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf); // フォント登録

        simplePdf.setFont('NotoSansJP', 'bold');
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
                simplePdf.setFont('NotoSansJP', 'bold');
                simplePdf.setFontSize(simpleFontSize);
            }
        });

        const simpleFilename = `セットリスト_シンプル_${headerText.replace(/[ /]/g, '_') || '日付なし'}.pdf`;
        simplePdf.save(simpleFilename);
        console.log("[generateSetlistPdf] Simple PDF generated and downloaded:", simpleFilename);

        showMessageBox("2種類のPDFを生成しました！");

    } catch (error) {
        console.error("[generateSetlistPdf] PDF生成に失敗しました:", error);
        showMessageBox("PDF生成に失敗しました。");
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
        showMessageBox('Firebaseが初期化されていません。');
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
                        if (error.name !== 'AbortError') showMessageBox('共有に失敗しました。');
                    });
            } else {
                const tempInput = document.createElement('textarea');
                tempInput.value = `${shareText}\n共有リンク: ${shareLink}`; // テキストとリンクを両方コピー
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showMessageBox('セットリスト情報と共有リンクをクリップボードにコピーしました！');
                console.log(`[shareSetlist] Setlist saved. Share ID: ${shareId}, Link: ${shareLink} (using execCommand)`);
            }
        })
        .catch(error => {
            console.error('[shareSetlist] Firebaseへの保存に失敗しました:', error);
            showMessageBox('セットリストの保存に失敗しました。');
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
            showMessageBox('Firebaseが初期化されていません。');
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
                    for (let i = 0; i < maxSongs; i++) {
                        clearSlotContent(setlist, i.toString());
                    }
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
                            fillSlotWithItem(targetSlot, itemData);
                            document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`).style.visibility = 'hidden';
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
                    showMessageBox('共有されたセットリストが見つかりませんでした。');
                    console.warn("[loadSetlistState] Shared setlist state not found or invalid.");
                    updateDatePickersToToday(); // デフォルトで今日の日付を設定
                    resolve();
                }
            })
            .catch((error) => {
                console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
                showMessageBox('セットリストのロードに失敗しました。');
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

// =============================================================================
// イベントリスナーの登録と初期化
// =============================================================================

/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
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

    // --- ドラッグ＆ドロップ関連の初期設定 ---
    document.querySelectorAll(".album-content .item").forEach(item => { // ここを修正
        enableDragAndDrop(item);
        item.addEventListener("dblclick", handleDoubleClick); // ★追加: アルバムアイテムにダブルクリックリスナーを追加
    });

    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        if (!slot.dataset.slotIndex) {
            slot.dataset.slotIndex = index.toString();
        }
        enableDragAndDrop(slot);

        // スロット内のチェックボックスに対するイベントリスナー（バブリング対策）
        slot.addEventListener('click', (e) => {
            const checkbox = e.target.closest('input[type="checkbox"]');
            if (checkbox) {
                e.stopPropagation();
                const optionType = checkbox.dataset.optionType;
                slot.classList.toggle(optionType === 'short' ? 'short' : optionType === 'se' ? 'se-active' : 'drumsolo-active', checkbox.checked);
                slot.dataset[`${optionType}${optionType === 'se' || optionType === 'drumsolo' ? 'Checked' : ''}`] = checkbox.checked ? 'true' : 'false';
                console.log(`[slotClick] Slot ${slot.dataset.slotIndex} ${optionType} status changed to: ${checkbox.checked}`);
                lastTapTime = 0;
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
        });

        // セットリストスロットにダブルクリックリスナーを追加（これは既に存在）
        slot.addEventListener("dblclick", handleDoubleClick);
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
        hideSetlistItemsInMenu();
    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        hideSetlistItemsInMenu();
    });
});