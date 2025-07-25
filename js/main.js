// main.js の一番上あたりにグローバル変数として定義されていることを確認
let currentPcDraggedElement = null;
let currentTouchDraggedClone = null;
let draggingItemId = null;
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false;
let touchTimeout = null;
const originalAlbumMap = new Map();
let originalSetlistSlot = null; // PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26;

let currentDropZone = null;
let activeTouchSlot = null;
let rafId = null;

/*------------------------------------------------------------------------------------------------------------*/

// --- ヘルパー関数 ---

/**
 * スロット内のアイテムからデータを抽出し、オブジェクトとして返すヘルパー関数。
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
    let hasDrumsoloOption = false;
    let hasShortOption = false;
    let hasSeOption = false;
    let albumClass = Array.from(element.classList).find(className => className.startsWith('album'));
    let itemId = element.dataset.itemId;

    let rGt = element.dataset.rGt || '';
    let lGt = element.dataset.lGt || '';
    let bass = element.dataset.bass || '';
    let bpm = element.dataset.bpm || '';
    let chorus = element.dataset.chorus || '';

    if (isSetlistItem) {
        const songInfo = element.querySelector('.song-info-container .song-name-and-option'); // .song-info から .song-name-and-option へ変更
        songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : element.dataset.songName; // テキストノードから取得
        
        const shortCheckbox = element.querySelector('input[type="checkbox"][data-option-type="short"]');
        isCheckedShort = shortCheckbox ? shortCheckbox.checked : false;
        const seCheckbox = element.querySelector('input[type="checkbox"][data-option-type="se"]');
        isCheckedSe = seCheckbox ? seCheckbox.checked : false;
        const drumsoloCheckbox = element.querySelector('input[type="checkbox"][data-option-type="drumsolo"]');
        isCheckedDrumsolo = drumsoloCheckbox ? drumsoloCheckbox.checked : false;

        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

        rGt = element.dataset.rGt || '';
        lGt = element.dataset.lGt || '';
        bass = element.dataset.bass || '';
        bpm = element.dataset.bpm || '';
        chorus = element.dataset.chorus || '';

    } else if (isAlbumItem) {
        songName = element.dataset.songName || element.textContent.trim();
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

        isCheckedShort = false;
        isCheckedSe = false;
        isCheckedDrumsolo = false;

        rGt = element.dataset.rGt || '';
        lGt = element.dataset.lGt || '';
        bass = element.dataset.bass || '';
        bpm = element.dataset.bpm || '';
        chorus = element.dataset.chorus || '';

    } else if (element.dataset.itemId) { // クローン要素などの場合 (currentTouchDraggedCloneなど)
        songName = element.dataset.songName;
        isCheckedShort = element.dataset.short ? element.dataset.short === 'true' : false;
        isCheckedSe = element.dataset.seChecked ? element.dataset.seChecked === 'true' : false;
        isCheckedDrumsolo = element.dataset.drumsoloChecked ? element.dataset.drumsoloChecked === 'true' : false;

        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

        rGt = element.dataset.rGt || '';
        lGt = element.dataset.lGt || '';
        bass = element.dataset.bass || '';
        bpm = element.dataset.bpm || '';
        chorus = element.dataset.chorus || '';

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
        // slotIndex: element.dataset.slotIndex, // これは setlist-slot に付くデータなので、item自身のデータには含めない
        rGt: rGt,
        lGt: lGt,
        bass: bass,
        bpm: bpm,
        chorus: chorus
    };
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * 指定されたスロットの内容をクリアし、空のスロット状態に戻す。
 * @param {Element} parentList - スロットが属する親リスト (通常は setlist)
 * @param {string} slotIndex - クリアするスロットの data-slot-index
 */
function clearSlotContent(parentList, slotIndex) {
    const slotToClear = parentList.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (slotToClear) {
        console.log(`[clearSlotContent] Clearing slot: ${slotIndex}`);

        const songInfoContainer = slotToClear.querySelector('.song-info-container');
        if (songInfoContainer) {
            songInfoContainer.innerHTML = '';
        }

        // 関連するクラスとデータ属性を全て削除
        slotToClear.classList.remove('setlist-item', 'item', 'short', 'se-active', 'drumsolo-active', 'placeholder-slot');
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id');
        slotToClear.removeAttribute('data-song-name');
        slotToClear.removeAttribute('data-is-short-version');
        slotToClear.removeAttribute('data-has-se-option');
        slotToClear.removeAttribute('data-has-drumsolo-option');
        slotToClear.removeAttribute('data-short');
        slotToClear.removeAttribute('data-se-checked');
        slotToClear.removeAttribute('data-drumsolo-checked');
        slotToClear.removeAttribute('data-r-gt');
        slotToClear.removeAttribute('data-l-gt');
        slotToClear.removeAttribute('data-bass');
        slotToClear.removeAttribute('data-bpm');
        slotToClear.removeAttribute('data-chorus');

        // もしスロット内にデフォルトで表示される要素（例：ドラッグハンドル、チェックボックスなど）が
        // clearSlotContentによって消えてしまう場合は、ここで再構築する必要があります。
        // 今回のHTML構造では、fillSlotWithItemが全てを再構築するため、ここでは不要と仮定。

        // スタイルをリセット
        slotToClear.style.cssText = '';
        slotToClear.style.visibility = ''; // 非表示になっていたら戻す

        // 関連するイベントリスナーを削除（fillSlotWithItemで再付与される）
        slotToClear.removeEventListener("dragstart", handleDragStart);
        slotToClear.removeEventListener("touchstart", handleTouchStart);
        slotToClear.removeEventListener("touchmove", handleTouchMove);
        slotToClear.removeEventListener("touchend", handleTouchEnd);
        slotToClear.removeEventListener("touchcancel", handleTouchEnd);
        slotToClear.draggable = false; // ドラッグ可能属性を無効化

        // 保存されていた元のアイテムデータを削除
        if (slotToClear._originalItemData) {
            delete slotToClear._originalItemData;
        }

        console.log(`[clearSlotContent] Slot ${slotIndex} cleared successfully. Final state:`, slotToClear.outerHTML);
    } else {
        console.warn(`[clearSlotContent] Slot to clear not found for index: ${slotIndex}`);
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * アイテムを元のアルバムリストに戻し、セットリストから削除する。
 * @param {Element} elementToProcess - セットリストから戻す、または削除する対象の要素（セットリストの .setlist-item 要素、またはアルバムの .item 要素）
 */
function restoreToOriginalList(elementToProcess) {
    const itemId = elementToProcess.dataset.itemId || draggingItemId;
    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found for restoration. Element:`, elementToProcess);
        if (elementToProcess === currentTouchDraggedClone && elementToProcess.parentNode === document.body) {
            elementToProcess.remove(); // クローン要素があれば削除
            console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body.");
        }
        return;
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}. Source element:`, elementToProcess);

    // アルバムメニュー内の元のアイテムを表示に戻す
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.visibility = '';
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // セットリスト内の該当スロットをクリアする (もし存在すれば)
    // ここでは elementToProcess が setlist-item であることを想定
    const slotToClearInSetlist = setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${itemId}"]`);
    if (slotToClearInSetlist) {
        console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotToClearInSetlist.dataset.slotIndex}`);
        clearSlotContent(setlist, slotToClearInSetlist.dataset.slotIndex);
    } else {
        console.log(`[restoreToOriginalList] Item ${itemId} was not in setlist (or slot not found), no slot to clear.`);
    }

    // 元のアルバムマップからエントリを削除
    if (originalAlbumMap.has(itemId)) {
        originalAlbumMap.delete(itemId);
        console.log(`[restoreToOriginalList] Deleted ${itemId} from originalAlbumMap.`);
    }
}

/*------------------------------------------------------------------------------------------------------------*/

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

    setTimeout(() => {
        messageBox.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        messageBox.style.opacity = '0';
        messageBox.addEventListener('transitionend', function handler() {
            messageBox.style.display = 'none';
            messageBox.removeEventListener('transitionend', handler);
        }, { once: true });
    }, 2000);
    console.log(`[showMessageBox] Displaying message: "${message}"`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * セットリスト内のアイテムをアルバムメニューから非表示にする。
 * この関数は、loadSetlistStateの完了後、または通常読み込み時に呼び出される。
 */
function hideSetlistItemsInMenu() {
    const allAlbumItems = document.querySelectorAll('.album-content .item');
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");

    // まず全てのアルバムアイテムを表示状態に戻す（念のため）
    allAlbumItems.forEach(item => {
        item.style.visibility = '';
    });
    console.log("[hideSetlistItemsInMenu] All album items temporarily made visible.");

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

/*------------------------------------------------------------------------------------------------------------*/

/**
 * セットリストの内容を取得する。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
    const currentSetlist = Array.from(document.querySelectorAll("#setlist .setlist-slot.setlist-item"))
        .map((slot, index) => {
            const songData = getSlotItemData(slot); // 新しいデータも取得
            let line = `${index + 1}. ${songData?.name || ''}`;
            if (songData.short) {
                line += ' (Short)';
            }
            if (songData.seChecked) {
                line += ' (SE有り)';
            }
            if (songData.drumsoloChecked) {
                line += ' (ドラムソロ有り)';
            }

            if (songData.rGt || songData.lGt || songData.bass) {
                line += ` (T:R${songData.rGt||''} L${songData.lGt||''} B${songData.bass||''})`;
            }
            if (songData.bpm) {
                line += ` (BPM:${songData.bpm})`;
            }
            if (songData.chorus) {
                line += ` (C:${songData.chorus})`;
            }
            return line;
        });
    console.log("[getSetlist] Current setlist:", currentSetlist);
    return currentSetlist;
}

/*------------------------------------------------------------------------------------------------------------*/

function getCurrentState() {
    const setlistState = Array.from(setlist.children)
        .map(slot => {
            if (slot.classList.contains('setlist-item')) {
                return getSlotItemData(slot);
            } else {
                return null;
            }
        })
        .filter(item => item !== null);

    const menuOpen = menu.classList.contains('open');
    const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

    const originalAlbumMapAsObject = {};
    originalAlbumMap.forEach((value, key) => {
        originalAlbumMapAsObject[key] = value;
    });

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    let selectedDate = '';
    if (setlistYear && setlistMonth && setlistDay) {
        selectedDate = `${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`;
    } else {
        console.warn("[getCurrentState] Date select elements (year, month, day) not found. Date will be empty for saving.");
    }

    const setlistVenue = document.getElementById('setlistVenue').value;

    console.log("[getCurrentState] Setlist state for saving:", setlistState);
    console.log("[getCurrentState] Original album map for saving:", originalAlbumMapAsObject);
    console.log("[getCurrentState] Date for saving:", selectedDate);
    console.log("[getCurrentState] Venue for saving:", setlistVenue);

    return {
        setlist: setlistState,
        menuOpen: menuOpen,
        openAlbums: openAlbums,
        originalAlbumMap: originalAlbumMapAsObject,
        setlistDate: selectedDate,
        setlistVenue: setlistVenue
    };
}

/*------------------------------------------------------------------------------------------------------------*/

// --- ドラッグ&ドロップ、タッチイベントハンドラ ---

/**
 * セットリストのスロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 */
function fillSlotWithItem(slotElement, songData) {
    console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
    console.log(`[fillSlotWithItem]   songData received:`, songData);

    const existingSongInfoContainer = slotElement.querySelector('.song-info-container');
    let songInfoContainer;
    if (existingSongInfoContainer) {
        songInfoContainer = existingSongInfoContainer;
        songInfoContainer.innerHTML = ''; // 既存の内容をクリア
    } else {
        songInfoContainer = document.createElement('div');
        songInfoContainer.classList.add('song-info-container');
        slotElement.appendChild(songInfoContainer);
    }

    const itemId = songData.itemId;
    const songName = songData.name;
    const albumClass = songData.albumClass;
    const isCurrentlyCheckedShort = songData.short;
    const isCurrentlyCheckedSe = songData.seChecked;
    const isCurrentlyCheckedDrumsolo = songData.drumsoloChecked;

    // スロットから関連するクラスを全て削除
    Array.from(slotElement.classList).forEach(cls => {
        if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active') {
            slotElement.classList.remove(cls);
        }
    });

    const hasShortOption = songData.hasShortOption === true;
    const hasSeOption = songData.hasSeOption === true;
    const hasDrumsoloOption = songData.hasDrumsoloOption === true;

    // --- 曲名とオプション（Short/SE/ドラムソロ）部分 ---
    const songNameAndOptionDiv = document.createElement('div');
    songNameAndOptionDiv.classList.add('song-name-and-option');

    const songNameTextNode = document.createTextNode(songName);
    songNameAndOptionDiv.appendChild(songNameTextNode);

    if (hasShortOption) {
        const checkboxWrapper = document.createElement('span');
        checkboxWrapper.classList.add('checkbox-wrapper');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isCurrentlyCheckedShort;
        checkbox.dataset.optionType = 'short';
        checkboxWrapper.appendChild(checkbox);
        const label = document.createElement('span');
        label.textContent = '(Short)';
        label.classList.add('short-label');
        checkboxWrapper.appendChild(label);
        songNameAndOptionDiv.appendChild(checkboxWrapper);
    }

    if (hasSeOption) {
        const checkboxWrapper = document.createElement('span');
        checkboxWrapper.classList.add('checkbox-wrapper');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isCurrentlyCheckedSe;
        checkbox.dataset.optionType = 'se';
        checkboxWrapper.appendChild(checkbox);
        const label = document.createElement('span');
        label.textContent = '(SE有り)';
        label.classList.add('se-label');
        checkboxWrapper.appendChild(label);
        songNameAndOptionDiv.appendChild(checkboxWrapper);
    }

    if (hasDrumsoloOption) {
        const checkboxWrapper = document.createElement('span');
        checkboxWrapper.classList.add('checkbox-wrapper');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isCurrentlyCheckedDrumsolo;
        checkbox.dataset.optionType = 'drumsolo';
        checkboxWrapper.appendChild(checkbox);
        const label = document.createElement('span');
        label.textContent = '(ドラムソロ有り)';
        label.classList.add('drumsolo-label');
        checkboxWrapper.appendChild(label);
        songNameAndOptionDiv.appendChild(checkboxWrapper);
    }

    // --- チューニング、BPM、コーラス情報の表示 ---
    const additionalInfoDiv = document.createElement('div');
    additionalInfoDiv.classList.add('additional-song-info');

    const infoParts = [];
    if (songData.rGt || songData.lGt || songData.bass) {
        infoParts.push(`A.Gt（${songData.rGt||''}） K.Gt（${songData.lGt||''}） B（${songData.bass||''}）`);
    }
    if (songData.bpm) {
        infoParts.push(`BPM:${songData.bpm}`);
    }
    if (songData.chorus) {
        infoParts.push(`コーラス:${songData.chorus}`);
    }

    if (infoParts.length > 0) {
        additionalInfoDiv.textContent = infoParts.join(' | ');
    } else {
        additionalInfoDiv.style.display = 'none';
    }

    songInfoContainer.appendChild(songNameAndOptionDiv);
    songInfoContainer.appendChild(additionalInfoDiv);

    slotElement.classList.toggle('short', isCurrentlyCheckedShort);
    slotElement.dataset.short = isCurrentlyCheckedShort ? 'true' : 'false';

    slotElement.classList.toggle('se-active', isCurrentlyCheckedSe);
    slotElement.dataset.seChecked = isCurrentlyCheckedSe ? 'true' : 'false';

    slotElement.classList.toggle('drumsolo-active', isCurrentlyCheckedDrumsolo);
    slotElement.dataset.drumsoloChecked = isCurrentlyCheckedDrumsolo ? 'true' : 'false';

    slotElement.classList.add('setlist-item', 'item');
    if (albumClass) {
        slotElement.classList.add(albumClass);
    }

    slotElement.dataset.itemId = itemId;
    slotElement.dataset.songName = songName;
    slotElement.dataset.isShortVersion = hasShortOption ? 'true' : 'false';
    slotElement.dataset.hasSeOption = hasSeOption ? 'true' : 'false';
    slotElement.dataset.hasDrumsoloOption = hasDrumsoloOption ? 'true' : 'false';

    slotElement.dataset.rGt = songData.rGt || '';
    slotElement.dataset.lGt = songData.lGt || '';
    slotElement.dataset.bass = songData.bass || '';
    slotElement.dataset.bpm = songData.bpm || '';
    slotElement.dataset.chorus = songData.chorus || '';

    // イベントリスナーを再付与 (enableDragAndDropのロジックを再利用)
    // ただし、enableDragAndDropは .item か .setlist-slot を期待するので、
    // ここでは .item としてのイベントリスナーを付与し直す
    slotElement.draggable = true; // ドラッグ可能にする
    slotElement.removeEventListener("dragstart", handleDragStart); // 既存を削除
    slotElement.addEventListener("dragstart", handleDragStart); // 再付与

    // タッチイベントも同様に再付与
    slotElement.removeEventListener("touchstart", handleTouchStart);
    slotElement.removeEventListener("touchmove", handleTouchMove);
    slotElement.removeEventListener("touchend", handleTouchEnd);
    slotElement.removeEventListener("touchcancel", handleTouchEnd);
    slotElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    slotElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    slotElement.addEventListener("touchend", handleTouchEnd);
    slotElement.addEventListener("touchcancel", handleTouchEnd);


    console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and events re-attached.`);
}


/*------------------------------------------------------------------------------------------------------------*/

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
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot); // データ取得
        console.log(`[dragstart:PC] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex}:`, originalSetlistSlot._originalItemData);

        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot');
        currentPcDraggedElement = originalElement;
        console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);

    } else {
        originalSetlistSlot = null; // アルバムからのドラッグなので元のスロットはセットリストには存在しない
        currentPcDraggedElement = originalElement;
        console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the currentPcDraggedElement.`);
    }

    if (!originalAlbumMap.has(draggingItemId)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(draggingItemId, originalListId);
        console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
    } else {
        console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
    }
    // PCでは currentPcDraggedElement に 'dragging' クラスを付与
    if (currentPcDraggedElement) { // originalElement ではなく currentPcDraggedElement にクラスを付与
        currentPcDraggedElement.classList.add("dragging");
    }


    console.log(`[dragstart] dataTransfer set with: ${draggingItemId}`);
    console.log(`[dragstart] currentPcDraggedElement element:`, currentPcDraggedElement);
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ要素がドロップターゲットに入った時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDragEnter(event) {
    event.preventDefault();
    const activeDraggingElement = currentPcDraggedElement || currentTouchDraggedClone;

    if (activeDraggingElement) {
        const targetSlot = event.target.closest('.setlist-slot');
        // 元のスロット自身へのdragenterは無視する
        if (originalSetlistSlot && targetSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            return;
        }
        if (targetSlot) {
            targetSlot.classList.add('drag-over');
            console.log(`[dragenter] Entered slot: ${targetSlot.dataset.slotIndex}`);
        }
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ退出時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        // relatedTargetがドロップゾーンの外に出たことを確認してクラスを削除
        // または、関連ターゲットがsetlist-slotの内部要素でないことを確認
        if (!event.relatedTarget || (!targetSlot.contains(event.relatedTarget) && !event.relatedTarget.classList.contains('setlist-slot'))) {
            targetSlot.classList.remove('drag-over');
            if (currentDropZone === targetSlot) {
                currentDropZone = null;
            }
            console.log(`[dragleave] Left slot: ${targetSlot.dataset.slotIndex}`);
        }
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグオーバー時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault();

    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }

    if (!draggingItemId) {
        // ドラッグ中のアイテムIDが設定されていない場合、処理しない
        console.warn("[handleDragOver] No draggingItemId set. Ignoring dragover.");
        return;
    }

    const targetSlot = event.target.closest('.setlist-slot');
    const newDropZone = targetSlot;

    if (newDropZone) {
        // ドラッグ元のスロット上ではハイライトしない
        if (originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            currentDropZone = null;
            return;
        }

        if (newDropZone !== currentDropZone) {
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            newDropZone.classList.add('drag-over');
            currentDropZone = newDropZone;
            console.log(`[handleDragOver] Active drop zone changed to: ${newDropZone.dataset.slotIndex}`);
        }
    } else if (currentDropZone) {
        // ドロップゾーンから外れた場合
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
        console.log("[handleDragOver] Left all drop zones.");
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ処理 (PCおよびモバイルの両方で呼び出される統一関数)
 * @param {Element} draggedElement - ドラッグされたアイテムのDOM要素 (アルバムアイテム、またはセットリストアイテム)
 * @param {Element} dropTargetSlot - ドロップ先の setlist-slot 要素
 * @param {Element|null} originalSetlistSlot - セットリストからドラッグされた場合の元の setlist-slot 要素。アルバムからの場合は null。
 */
function processDrop(draggedElement, dropTargetSlot, originalSetlistSlot = null) {
    console.log("[processDrop] Initiated. draggedElement:", draggedElement, "dropTargetSlot:", dropTargetSlot, "originalSetlistSlot:", originalSetlistSlot);

    const itemId = draggedElement.dataset.itemId;
    if (!itemId) {
        console.error("[processDrop] draggedElement has no itemId. Aborting processDrop.");
        return;
    }

    let draggedItemData = null;
    if (originalSetlistSlot && originalSetlistSlot._originalItemData) {
        draggedItemData = originalSetlistSlot._originalItemData;
        console.log("[processDrop] Using _originalItemData from originalSetlistSlot:", draggedItemData);
    } else {
        draggedItemData = getSlotItemData(draggedElement);
        // アルバムからのドラッグの場合、オプションの有無は元のアルバムアイテムから取得
        const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (originalAlbumItem) {
            draggedItemData.hasShortOption = originalAlbumItem.dataset.isShortVersion === 'true';
            draggedItemData.hasSeOption = originalAlbumItem.dataset.hasSeOption === 'true';
            draggedItemData.hasDrumsoloOption = originalAlbumItem.dataset.hasDrumsoloOption === 'true';
        }
        console.log("[processDrop] Using data from draggedElement (and enriched for album item):", draggedItemData);
    }

    if (!draggedItemData) {
        console.error("[processDrop] Failed to get item data. Aborting processDrop.");
        return;
    }

    const isDraggedFromSetlist = originalSetlistSlot !== null;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    if (isDraggedFromSetlist) {
        // セットリスト内でのアイテム移動またはセットリスト外への移動
        if (dropTargetSlot) {
            // ドロップターゲットにすでにアイテムがある場合（スワップ）
            if (dropTargetSlot.classList.contains('setlist-item')) {
                console.log(`[processDrop] Swapping items. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                const targetSlotItemData = getSlotItemData(dropTargetSlot);
                if (targetSlotItemData) {
                    // ターゲットスロットのアイテムを元のスロットに戻す
                    clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex); // 元のスロットを一旦クリア
                    fillSlotWithItem(originalSetlistSlot, targetSlotItemData); // 元のスロットにターゲットのアイテムをフィル
                }
                // 元のアイテムをターゲットスロットにフィル
                clearSlotContent(setlist, dropTargetSlot.dataset.slotIndex); // ターゲットスロットをクリア
                fillSlotWithItem(dropTargetSlot, draggedItemData); // ターゲットスロットに元のアイテムをフィル
            } else {
                // ドロップターゲットが空のスロットの場合（移動）
                console.log(`[processDrop] Moving item to empty slot. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex); // 元のスロットをクリア
                fillSlotWithItem(dropTargetSlot, draggedItemData); // ターゲットスロットにアイテムをフィル
            }
        } else {
            // セットリスト外にドロップされた場合（セットリストからの削除）
            console.log("[processDrop] Dropped outside setlist (from setlist). Restoring original album item and clearing setlist slot.");
            restoreToOriginalList(originalSetlistSlot); // セットリストから元のアルバムに戻す
        }
    } else {
        // アルバムからのアイテム追加
        if (dropTargetSlot) {
            if (dropTargetSlot.classList.contains('setlist-item')) {
                // ターゲットスロットが既に埋まっている場合は追加しない
                showMessageBox('このスロットはすでに埋まっています。');
                restoreToOriginalList(draggedElement); // ドラッグ元がアルバムアイテムなので表示を戻す
                return;
            }

            // 最大曲数チェック
            const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
            if (currentSongCount >= maxSongs) {
                showMessageBox('セットリストは最大曲数に達しています。');
                restoreToOriginalList(draggedElement); // ドラッグ元がアルバムアイテムなので表示を戻す
                return;
            }

            console.log(`[processDrop] Adding item from album. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
            fillSlotWithItem(dropTargetSlot, draggedItemData);
            // アルバム内の元のアイテムを非表示にする
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItem) {
                albumItem.style.visibility = 'hidden';
            }
        } else {
            // アルバムアイテムがセットリスト外にドロップされた場合
            console.log("[processDrop] Dropped album item outside setlist. Restoring to original list.");
            restoreToOriginalList(draggedElement); // アルバムアイテムを表示に戻す
        }
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ時の処理。(PCドラッグ＆ドロップイベントリスナーから呼び出される)
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
    event.preventDefault();
    console.log("[handleDrop] Drop event fired.");
    const droppedItemId = event.dataTransfer.getData("text/plain");
    console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

    let draggedItem;
    // PCドラッグの場合、currentPcDraggedElement が既に設定されているはず
    if (currentPcDraggedElement && currentPcDraggedElement.dataset.itemId === droppedItemId) {
        draggedItem = currentPcDraggedElement;
        console.log("[handleDrop] Using currentPcDraggedElement as draggedItem.");
    } else {
        // フォールバック（通常は発生しないはず）
        draggedItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
        if (!draggedItem) {
            console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". Aborting handleDrop.");
            finishDragging();
            return;
        }
        console.log("[handleDrop] Searched for draggedItem in album content by ID (fallback).");
    }

    const dropTargetSlot = event.target.closest('.setlist-slot');
    console.log("[handleDrop] dropTargetSlot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (dropped outside)");

    // processDropを呼び出す
    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);

    finishDragging(); // ドラッグ終了後のクリーンアップ
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ開始時の処理
 */
function handleTouchStart(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    const isCheckboxClick = closestCheckbox !== null;

    if (isCheckboxClick) {
        console.log("[touchstart:Mobile] Checkbox clicked directly. Allowing native behavior.");
        lastTapTime = 0; // ダブルタップ検出をリセット
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        isDragging = false; // ドラッグ状態もリセット
        return; // チェックボックスの動作を妨げないため、ここでは event.preventDefault() を呼ばない
    }

    // ★修正ポイント: タップ対象が .setlist-item または .item であることを厳密に確認する ★
    // これにより、「曲と曲の間」の空白部分のタッチでドラッグが開始されるのを防ぐ
    const touchedItemElement = event.target.closest(".setlist-item") || event.target.closest(".item");
    if (!touchedItemElement) {
        console.warn("[touchstart:Mobile] Touched element is not a setlist-item or album item. Ignoring touch for drag/double tap.");
        // スロットの空き部分を触った場合は、ここでイベントをブロックする
        event.preventDefault(); // デフォルト動作（スクロール、ズームなど）を防ぐ
        if (touchTimeout) { // 念のためタイマーもクリア
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        lastTapTime = 0; // ダブルタップ判定もリセット
        return;
    }
    console.log("[touchstart:Mobile] Touched element (non-checkbox, is item):", touchedItemElement);
    console.log("[touchstart:Mobile] Touched element itemId:", touchedItemElement.dataset.itemId);


    // チェックボックス以外の要素がタッチされた場合のダブルタップ検出
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault(); // ダブルタップの場合のみデフォルト動作をキャンセル
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event); // ここで handleDoubleClick を呼び出す
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime; // 次のタップ判定のために時間を更新


    if (event.touches.length === 1) {
        // touchedItemElement が取得できた場合のみ、以下のドラッグロジックに進む
        isDragging = false;
        draggingItemId = touchedItemElement.dataset.itemId;

        if (setlist.contains(touchedItemElement) && touchedItemElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedItemElement;
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
        } else {
            originalSetlistSlot = null;
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // 長押しでドラッグを開始するためのタイマーを設定
        touchTimeout = setTimeout(() => {
            // isDragging がまだ false であることを確認（touchmoveでドラッグに移行していないことを意味する）
            if (!isDragging && draggingItemId && document.body.contains(touchedItemElement)) {
                event.preventDefault(); // ここで preventDefault を呼ぶことで、スクロールなどを防ぎ、ドラッグに専念させる
                createTouchDraggedClone(touchedItemElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true;
                console.log("[touchstart:Mobile] Long press detected. Initiating touch drag.");
            } else {
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout (already dragging or item invalid).");
            }
            touchTimeout = null; // タイマー完了
        }, 600); // 例: 600ミリ秒のロングプレスでドラッグ開始
    }
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    // 長押しタイマーが動いている間に指が動いたら、長押しではなくタップとみなすためタイマーをクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        // isDragging が true になる前に指が動いた場合、これはドラッグではない通常のスクロールとみなす
        // その場合、ここで処理を中断し、ネイティブのスクロール動作を許可する
        // return; // このreturnを有効にすると、短く指を動かしてもドラッグと認識されなくなるので注意
    }

    // ドラッグ中ではない場合は、基本的にネイティブのスクロールなどを許可し、処理を終了
    if (!isDragging || !currentTouchDraggedClone) {
        return;
    }

    event.preventDefault(); // ドラッグ中はスクロールなどのデフォルト動作を抑制

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        if (!currentTouchDraggedClone) {
            rafId = null;
            return;
        }
        const touch = event.touches[0];
        const newX = touch.clientX;
        const newY = touch.clientY;

        const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
        currentTouchDraggedClone.style.left = (newX - cloneRect.width / 2) + 'px';
        currentTouchDraggedClone.style.top = (newY - cloneRect.height / 2) + 'px';

        const targetElement = document.elementFromPoint(newX, newY);
        const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

        // 元のスロット自身へのdrag-overはハイライトしない
        if (originalSetlistSlot && newDropZone && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            currentDropZone = null;
            rafId = null;
            return;
        }

        if (newDropZone !== currentDropZone) {
            if (currentDropZone) currentDropZone.classList.remove('drag-over');
            if (newDropZone) newDropZone.classList.add('drag-over');
            currentDropZone = newDropZone;
            console.log(`[handleTouchMove] Active touch drop zone changed to: ${newDropZone ? newDropZone.dataset.slotIndex : 'none'}`);
        }

        rafId = null;
    });
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ終了時の処理
 */
function handleTouchEnd(event) {
    if (touchTimeout) { // 長押しタイマーがまだ残っている場合、タップだったと判断
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] Touch ended before long press, not a drag. Skipping drag-specific logic.");
        // ここでisDraggingをfalseにしないと、isDragging=trueのままになる可能性あり
        isDragging = false;
        // PCのダブルクリックで削除するロジック（handleDoubleClick）はtouchstartで既に処理済みなので、ここでは何もしない
        // lastTapTimeはtouchstartで設定され、ダブルタップ後にリセットされるので、ここでの処理は不要
        return; // ドラッグではなかったので、ここで処理を終了
    }

    // ドラッグ中でなければ、処理を終了
    if (!isDragging) {
        console.log("[touchend] Not dragging. Skipping drag-specific logic.");
        finishDragging(); // クリーンアップ（念のため）
        return;
    }

    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging();
        return;
    }

    // ドロップゾーンのハイライトを解除
    document.querySelectorAll('.setlist-slot.drag-over')
        .forEach(slot => slot.classList.remove('drag-over'));

    const touch = event.changedTouches[0];
    const dropTargetSlot = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.setlist-slot');
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

    // processDropを呼び出す
    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    finishDragging(); // ドラッグ終了後のクリーンアップ
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    // 既存のクローンがあれば削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    // オリジナル要素が有効かつDOMに存在することを確認
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body. Aborting clone creation.");
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // クラスのコピー
    // `fillSlotWithItem`が`setlist-item`を再構築する際に、これらのクラスも適切にコピーされるはずなので、
    // ここでの手動コピーは冗長になる可能性もあるが、安全策として維持。
    if (originalElement.classList.contains('short')) {
        currentTouchDraggedClone.classList.add('short');
    }
    if (originalElement.classList.contains('se-active')) {
        currentTouchDraggedClone.classList.add('se-active');
    }
    if (originalElement.classList.contains('drumsolo-active')) {
        currentTouchDraggedClone.classList.add('drumsolo-active');
    }

    // dataset のコピー (より汎用的な方法)
    // ただし、data-item-id は itemIdToClone で上書きされる
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; // 正しい itemId に設定

    document.body.appendChild(currentTouchDraggedClone);

    // ✅ セットリスト内のアイテムだった場合、元のスロットをプレースホルダーとして隠す
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        const originalItemData = getSlotItemData(originalElement);
        if (originalItemData) {
            originalSetlistSlot._originalItemData = originalItemData; // 元のアイテムデータを保存
            console.log(`[createTouchDraggedClone] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex}:`, originalItemData);
        }
        originalSetlistSlot.classList.add('placeholder-slot');
        originalElement.style.visibility = 'hidden';
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else {
        // アルバムリストからのアイテムの場合、元のアイテムを隠す
        originalElement.style.visibility = 'hidden';
        originalSetlistSlot = null; // アルバムからのドラッグなので元のスロットはセットリストには存在しない
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録
    if (!originalAlbumMap.has(itemIdToClone)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId);
        console.log(`[createTouchDraggedClone] Original list ID for ${itemIdToClone} stored: ${originalListId}`);
    }

    // クローンの位置調整とスタイル設定
    const rect = originalElement.getBoundingClientRect();
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = rect.width + 'px';
    currentTouchDraggedClone.style.height = rect.height + 'px';
    currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローン下の要素のイベントをブロック

    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
    console.log("[finishDragging] Initiating drag operation finalization.");

    // PCドラッグ中の要素のクラスを削除
    if (currentPcDraggedElement && setlist.contains(currentPcDraggedElement)) {
        currentPcDraggedElement.classList.remove("dragging");
        console.log(`[finishDragging] Removed 'dragging' class for PC setlist item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
    }

    // モバイルのクローン要素を削除
    if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
        currentTouchDraggedClone.remove();
        console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
    }
    currentTouchDraggedClone = null; // クローンをnullにリセット

    // originalSetlistSlot がプレースホルダー状態であれば、一時的なスタイルを解除する
    if (originalSetlistSlot) { // originalSetlistSlot が存在する場合のみ処理
        if (originalSetlistSlot.classList.contains('placeholder-slot')) {
            originalSetlistSlot.classList.remove('placeholder-slot');
        }
        // ✅ 修正: setlist-item クラスが残っている場合のみ visibility を戻す
        //         clearSlotContent で既に消されている場合は visibility を戻す必要はない（既に空）
        //         これは、fillSlotWithItemが呼ばれていない場合に、隠した元のスロットを戻す処理
        if (!originalSetlistSlot.classList.contains('setlist-item')) {
            // スロットが空になっている場合（アイテムが移動済み）
            originalSetlistSlot.style.visibility = ''; // 確実に表示状態に戻す
            console.log(`[finishDragging] OriginalSetlistSlot ${originalSetlistSlot.dataset.slotIndex} was cleared, ensuring visibility is normal.`);
        } else {
            // スロットにアイテムが残っている場合（ドロップがキャンセルされた、またはスワップ）
            originalSetlistSlot.style.visibility = '';
            console.log(`[finishDragging] Restored visibility for originalSetlistSlot (still has item): ${originalSetlistSlot.dataset.slotIndex}.`);
        }
        if (originalSetlistSlot._originalItemData) {
            delete originalSetlistSlot._originalItemData; // 保存していたデータを削除
        }
    }

    // 全てのドロップゾーンからハイライトを削除
    setlist.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
    });
    console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

    // グローバルなドラッグ状態変数をリセット
    currentDropZone = null;
    activeTouchSlot = null;
    currentPcDraggedElement = null;
    draggingItemId = null;
    isDragging = false;
    originalSetlistSlot = null; // ここでoriginalSetlistSlotも完全にリセット

    // 残っているタイマーやアニメーションフレームをクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // メニュー内のアイテム表示を更新
    hideSetlistItemsInMenu();

    console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
    console.log("[finishDragging] Global variables state after reset:");
    console.log("  isDragging:", isDragging);
    console.log("  currentTouchDraggedClone:", currentTouchDraggedClone);
    console.log("  currentPcDraggedElement:", currentPcDraggedElement);
    console.log("  draggingItemId:", draggingItemId);
    console.log("  originalSetlistSlot:", originalSetlistSlot);
    console.log("  currentDropZone:", currentDropZone);
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ダブルクリック（ダブルタップ）時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDoubleClick(event) {
    const item = event.target.closest(".setlist-item") || event.target.closest(".item"); // .item を後から探す
    if (!item) {
        console.log("[handleDoubleClick] No item found for double click.");
        finishDragging(); // 念のためクリーンアップ
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

    const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

    if (isInsideSetlist) {
        // セットリスト内のアイテムの場合：セットリストから削除し、アルバムリストに戻す
        console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
        restoreToOriginalList(item);
    } else {
        // アルバムリスト内のアイテムの場合：セットリストに追加する
        console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
        const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));

        if (!emptySlot) {
            showMessageBox('セットリストは最大曲数に達しています。');
            console.log("[handleDoubleClick] Setlist is full.");
            finishDragging();
            return;
        }

        // すでにセットリストに同じアイテムがあるかチェック
        if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
            const originalList = item.parentNode;
            originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null);
            console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);

            item.style.visibility = 'hidden'; // アルバム内の元のアイテムを非表示にする
            console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

            const itemData = getSlotItemData(item);
            if (itemData) {
                // アルバムアイテムのdatasetから直接オプションの有無を取得し、itemDataにマージ
                itemData.hasShortOption = item.dataset.isShortVersion === 'true';
                itemData.hasSeOption = item.dataset.hasSeOption === 'true';
                itemData.hasDrumsoloOption = item.dataset.hasDrumsoloOption === 'true'; // ドラムソロオプションの有無

                fillSlotWithItem(emptySlot, itemData);
                console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
            } else {
                console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
            }
        } else {
            console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
        }
    }
    finishDragging(); // 処理後クリーンアップ
}
// document.addEventListener("dblclick", handleDoubleClick); // DOMContentLoaded内で付与されるためコメントアウト

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // 既にイベントリスナーが設定されているか確認
    if (element.dataset.dndEnabled === 'true') {
        return; // すでに有効化されている場合は何もしない
    }

    if (element.classList.contains('item')) {
        // アイテムの場合（アルバムまたはセットリスト内の曲）
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) {
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true; // PCでのドラッグを有効化

        element.addEventListener("dragstart", handleDragStart);
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
        console.log(`[enableDragAndDrop] Enabled drag/touch for item: ${element.dataset.itemId}`);
    } else if (element.classList.contains('setlist-slot')) {
        // セットリストのスロットの場合（ドロップゾーンとして）
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
        console.log(`[enableDragAndDrop] Enabled drop for slot: ${element.dataset.slotIndex || 'N/A'}`);
    }
    element.dataset.dndEnabled = 'true'; // 有効化フラグを設定
}

// Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
document.addEventListener("dragend", finishDragging);


/*------------------------------------------------------------------------------------------------------------*/

// --- UI操作関数と状態管理 ---

/**
 * メニューの開閉を切り替える。
 */
function toggleMenu() {
    menu.classList.toggle("open");
    menuButton.classList.toggle("open");
    console.log(`[toggleMenu] Menu is now: ${menu.classList.contains('open') ? 'open' : 'closed'}`);
}


/*------------------------------------------------------------------------------------------------------------*/

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

/*------------------------------------------------------------------------------------------------------------*/

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
    if (typeof firebase === 'undefined' || !firebase.database) {
        showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    const currentState = getCurrentState(); // 日付と会場がここに含まれる
    const setlistRef = database.ref('setlists').push();

    setlistRef.set(currentState)
        .then(() => {
            const shareId = setlistRef.key;
            const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

            const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
            let songListText = "";
            let itemNo = 1; // 共有テキスト用の連番カウンタ

            // album1ItemIds がどこかで定義されていることを確認
            const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

            if (setlistItems.length > 0) {
                songListText = Array.from(setlistItems).map(slot => {
                    const songData = getSlotItemData(slot);
                    let titleText = songData?.name || '';

                    if (songData.short) {
                        titleText += ' (Short)';
                    }
                    if (songData.seChecked) {
                        titleText += ' (SE有り)';
                    }
                    if (songData.drumsoloChecked) {
                        titleText += ' (ドラムソロ有り)';
                    }

                    const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                    let line = '';
                    if (isAlbum1) {
                        line = `    ${titleText}`; // 4つの半角スペースでインデント
                    } else {
                        line = `${itemNo}. ${titleText}`;
                        itemNo++; // album1以外の曲の場合のみ連番をインクリメント
                    }
                    return line;
                }).join("\n");
            }

            let shareText = '\n';
            if (currentState.setlistDate) {
                shareText += `日付: ${currentState.setlistDate}\n`;
            }
            if (currentState.setlistVenue) {
                shareText += `会場: ${currentState.setlistVenue}\n`;
            }
            if (songListText) {
                shareText += `\n${songListText}`;
            }

            if (navigator.share) {
                navigator.share({
                        text: shareText,
                        url: shareLink,
                    })
                    .then(() => {
                        console.log('[shareSetlist] Web Share API (URL) Success');
                        showMessageBox('セットリストを共有しました！');
                    })
                    .catch((error) => {
                        console.error('[shareSetlist] Web Share API (URL) Failed:', error);
                        if (error.name !== 'AbortError') {
                            showMessageBox('共有に失敗しました。');
                        }
                    });
            } else {
                const tempInput = document.createElement('textarea');
                tempInput.value = shareLink; // リンクのみをコピー
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showMessageBox('共有リンクをクリップボードにコピーしました！ (Web Share API非対応)');
                console.log(`[shareSetlist] Setlist saved. Share ID: ${shareId}, Link: ${shareLink} (using execCommand)`);
            }
        })
        .catch(error => {
            console.error('[shareSetlist] Firebaseへの保存に失敗しました:', error);
            showMessageBox('セットリストの保存に失敗しました。');
        });
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * セットリストのPDFを生成し、共有またはダウンロードする。
 * 提供されたPDF形式（テーブル形式）に似たレイアウトで生成し、日本語に対応。
 * jsPDF-AutoTableを使用する。
 */
async function generateSetlistPdf() {
    showMessageBox("PDFを生成中...");
    console.log("[generateSetlistPdf] PDF generation started.");

    const setlistYear = document.getElementById('setlistYear').value;
    const setlistMonth = document.getElementById('setlistMonth').value;
    const setlistDay = document.getElementById('setlistDay').value;
    const setlistVenue = document.getElementById('setlistVenue').value;

    let headerText = '';
    if (setlistYear && setlistMonth && setlistDay) {
        headerText += `${setlistYear}/${parseInt(setlistMonth)}/${parseInt(setlistDay)}`;
    }
    if (setlistVenue) {
        if (headerText) headerText += ' ';
        headerText += setlistVenue;
    }

    const tableHeaders = [
        "No.", "タイトル", "R.Gt(克哉)", "L.Gt(彰)", "Bass(信人)", "BPM", "コーラス"
    ];

    const tableBody = [];
    const simplePdfBody = []; // シンプルなPDF用のボディ
    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

    let currentItemNo = 1; // 詳細PDF用の連番カウンタ
    let simpleItemNo = 1;  // シンプルPDF用の連番カウンタ（非album1曲用）

    // album1として扱うdata-item-idのリスト
    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010', 'album1-011', 'album1-012', 'album1-013'];

    // 共有テキストの内容を格納する変数もここで準備
    let shareableTextContent = '';
    let shareableTextItemNo = 1; // 共有テキスト用の連番カウンタ

    // ヘッダーテキストを共有テキストにも追加
    if (headerText) {
        shareableTextContent += `${headerText}\n\n`; // 日付・会場名の後に2行改行
    }


    for (const slot of setlistSlots) {
        if (slot.classList.contains('setlist-item')) {
            const songData = getSlotItemData(slot);
            if (songData) {
                let titleText = songData.name || '';
                if (songData.short) {
                    titleText += ' (Short)';
                }
                if (songData.seChecked) {
                    titleText += ' (SE有り)';
                }
                if (songData.drumsoloChecked) {
                    titleText += ' (ドラムソロ有り)';
                }

                // data-item-idがalbum1ItemIdsリストに含まれているかをチェック
                const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                // --- 詳細PDF用の行の生成 ---
                let detailedItemNo = '';
                if (!isAlbum1) {
                    detailedItemNo = currentItemNo.toString();
                    currentItemNo++;
                }
                const detailedRow = [
                    detailedItemNo,
                    titleText,
                    songData.rGt || '',
                    songData.lGt || '',
                    songData.bass || '',
                    songData.bpm || '',
                    songData.chorus || ''
                ];
                tableBody.push(detailedRow);

                // --- シンプルPDF用の行の生成 ---
                if (isAlbum1) {
                    simplePdfBody.push(`    ${titleText}`); // 4つの半角スペースでインデント
                } else {
                    simplePdfBody.push(`${simpleItemNo}. ${titleText}`);
                    simpleItemNo++; // album1以外の曲の場合のみ連番をインクリメント
                }

                // --- 共有テキスト用の行の生成 ---
                if (isAlbum1) {
                    shareableTextContent += `    ${titleText}\n`; // 4つの半角スペースでインデント
                } else {
                    shareableTextContent += `${shareableTextItemNo}. ${titleText}\n`;
                    shareableTextItemNo++;
                }
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                // 詳細PDF用の行 (テキストスロット)
                tableBody.push([textContent, '', '', '', '', '', '']);
                // シンプルPDF用の行 (テキストスロットはNo.なし、そのまま追加)
                simplePdfBody.push(textContent);
                // 共有テキスト用の行 (テキストスロットはNo.なし、そのまま追加)
                shareableTextContent += `${textContent}\n`;
            }
        }
    }

    console.log("[generateSetlistPdf] Generated Shareable Text:\n", shareableTextContent);


    try {
        const { jsPDF } = window.jspdf;

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
                font: 'NotoSansJP',
                fontStyle: 'bold',
                fontSize: 10,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                font: 'NotoSansJP',
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 72, halign: 'left' },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' },
                5: { cellWidth: 18, halign: 'center' },
                6: { cellWidth: 22, halign: 'center' }
            },
            margin: { top: topMargin, right: 10, bottom: 10, left: leftMargin },
            didDrawPage: function (data) {
                let str = 'Page ' + detailedPdf.internal.getNumberOfPages();
                detailedPdf.setFontSize(10);
                detailedPdf.setFont('NotoSansJP', 'normal');
                detailedPdf.text(str, detailedPdf.internal.pageSize.getWidth() - 10, detailedPdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        });

        let detailedFilename = "セットリスト_詳細";
        if (setlistYear && setlistMonth && setlistDay) {
            detailedFilename += `_${setlistYear}-${setlistMonth}-${setlistDay}`;
        }
        if (setlistVenue) {
            detailedFilename += `_${setlistVenue}`;
        }
        detailedFilename += ".pdf";

        detailedPdf.save(detailedFilename);
        console.log("[generateSetlistPdf] Detailed PDF generated and downloaded:", detailedFilename);

        await new Promise(resolve => setTimeout(resolve, 500));

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf); // フォント登録

        simplePdf.setFont('NotoSansJP', 'bold');
       
        const simpleFontSize = 28; 
        simplePdf.setFontSize(simpleFontSize); 

        const simpleTopMargin = 30; 
        let simpleYPos = simpleTopMargin;

        const simpleLeftMargin = 25; 

        // ヘッダーテキスト（日付と会場）
        if (headerText) {
            // ★修正点: ヘッダーフォントサイズをさらに大きく調整
            simplePdf.setFontSize(simpleFontSize + 8); // 例: 32 + 8 = 40pt
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            // ★修正点: ヘッダーテキストと曲リストの間の余白を大幅に増やす
            simpleYPos += simpleFontSize * 0.7; // フォントサイズの1.5倍程度の余白
            simplePdf.setFontSize(simpleFontSize); // サイズを曲リスト用に戻す
        }

        // 各曲目をテキストとして追加
        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            // ★修正点: 曲間の行の高さをフォントサイズに合わせて調整
            // フォントサイズ32ptの場合、行の高さは40mm程度が適切かもしれません。
            simpleYPos += simpleFontSize * 0.38; // フォントサイズの1.25倍程度の行間隔

            // ページ下部に近づいたら新しいページを追加
            // simpleYPos > simplePdf.internal.pageSize.getHeight() - 20 の '20' も調整が必要かもしれません。
            // ここではフォントサイズに合わせて動的に計算するように変更します。
            const bottomMarginThreshold = simpleFontSize + 10; // フォントサイズ + 少しの余白
            if (simpleYPos > simplePdf.internal.pageSize.getHeight() - bottomMarginThreshold) {
                simplePdf.addPage();
                simpleYPos = simpleTopMargin;
                simplePdf.setFont('NotoSansJP', 'bold');
                simplePdf.setFontSize(simpleFontSize);
            }
        });

        let simpleFilename = "セットリスト_シンプル";
        if (setlistYear && setlistMonth && setlistDay) {
            simpleFilename += `_${setlistYear}-${setlistMonth}-${setlistDay}`;
        }
        if (setlistVenue) {
            simpleFilename += `_${setlistVenue}`;
        }
        simpleFilename += ".pdf";

        simplePdf.save(simpleFilename);
        console.log("[generateSetlistPdf] Simple PDF generated and downloaded:", simpleFilename);

        showMessageBox("2種類のPDFを生成しました！");

    } catch (error) {
        console.error("[generateSetlistPdf] PDF生成に失敗しました:", error);
        showMessageBox("PDF生成に失敗しました。");
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
 * @returns {Promise<void>} ロード処理の完了を示すPromise
 */
function loadSetlistState() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('shareId');

    if (shareId) {
      if (typeof firebase === 'undefined' || !firebase.database) {
        showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
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

            for (let i = 0; i < maxSongs; i++) {
              clearSlotContent(setlist, i.toString());
            }
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.visibility = '';
            });
            originalAlbumMap.clear();
            console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

            if (state.originalAlbumMap) {
              for (const key in state.originalAlbumMap) {
                originalAlbumMap.set(key, state.originalAlbumMap[key]);
              }
              console.log("[loadSetlistState] originalAlbumMap restored:", originalAlbumMap);
            }

            const setlistYear = document.getElementById('setlistYear');
            const setlistMonth = document.getElementById('setlistMonth');
            const setlistDay = document.getElementById('setlistDay');
            const setlistVenue = document.getElementById('setlistVenue');

            if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                const dateParts = state.setlistDate.split('-'); 
                if (dateParts.length === 3) {
                    setlistYear.value = dateParts[0];
                    setlistMonth.value = dateParts[1];
                    
                    if (typeof updateDays === 'function') {
                        updateDays(); 
                    } else {
                        console.warn("[loadSetlistState] updateDays function is not defined. Day dropdown might not be correctly populated.");
                    }
                    setlistDay.value = dateParts[2];

                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found.");
                if (setlistYear) setlistYear.value = new Date().getFullYear();
                if (setlistMonth) setlistMonth.value = (new Date().getMonth() + 1).toString().padStart(2, '0');
                if (typeof updateDays === 'function') updateDays();
                if (setlistDay) setlistDay.value = new Date().getDate().toString().padStart(2, '0');
            }
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            state.setlist.forEach(itemData => {
              const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
              if (targetSlot) {
                  console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                  fillSlotWithItem(targetSlot, itemData);

                  const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
                  if (albumItemInMenu) {
                      albumItemInMenu.style.visibility = 'hidden';
                      console.log(`[loadSetlistState] Hid album item in menu: ${itemData.itemId}`);
                  }
              } else {
                  console.warn(`[loadSetlistState] Target slot not found for index: ${itemData.slotIndex}`);
              }
            });

            if (state.menuOpen) {
              menu.classList.add('open');
              menuButton.classList.add('open');
            } else {
              menu.classList.remove('open');
              menuButton.classList.remove('open');
            }
            if (state.openAlbums && Array.isArray(state.openAlbums)) {
              document.querySelectorAll('.album-content').forEach(album => album.classList.remove('active'));
              state.openAlbums.forEach(albumId => {
                const albumElement = document.getElementById(albumId);
                if (albumElement) {
                  albumElement.classList.add('active');
                }
              });
            }
            resolve();
          } else {
            showMessageBox('共有されたセットリストが見つかりませんでした。');
            console.warn("[loadSetlistState] Shared setlist state not found or invalid.");
            resolve();
          }
        })
        .catch((error) => {
          console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
          showMessageBox('セットリストのロードに失敗しました。');
          reject(error);
        });
    } else {
      console.log("[loadSetlistState] No shareId found in URL. Loading default state.");
      const setlistYear = document.getElementById('setlistYear');
      const setlistMonth = document.getElementById('setlistMonth');
      const setlistDay = document.getElementById('setlistDay');
      if (setlistYear && setlistMonth && setlistDay) {
          const today = new Date();
          setlistYear.value = today.getFullYear();
          setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
          if (typeof updateDays === 'function') {
              updateDays(); 
          }
          setlistDay.value = today.getDate().toString().padStart(2, '0');
          console.log(`[loadSetlistState] Initialized date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
      }
      resolve();
    }
  });
}


/*------------------------------------------------------------------------------------------------------------*/

// グローバル変数として定義

const DOUBLE_TAP_DELAY = 350; // ダブルタップと認識する間隔（ミリ秒）
const TAP_MOVE_THRESHOLD = 10; // タップと認識する指の移動距離（ピクセル）
let initialTouchX = 0;
let initialTouchY = 0;
let isDraggingTouch = false; // タッチによるドラッグ操作中かどうかを示すフラグ
let currentDraggedItem = null; // 現在ドラッグ中の setlist-item を保持

document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop, date pickers, and modals.");

    const setlist = document.getElementById('setlist');
    if (!setlist) {
        console.error("[DOMContentLoaded Error] #setlist element not found. Drag and drop initialization may fail.");
        return; 
    }


    // アルバムアイテムにドラッグ＆ドロップイベントを設定
    document.querySelectorAll(".album-content .item").forEach((item) => {
        enableDragAndDrop(item);
        console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId}`);
    });

    // setlist-item がDOMに追加された際にイベントリスナーを設定するためのヘルパー関数
    const initializeSetlistItem = (itemElement) => {
        if (!itemElement || itemElement.dataset.initialized) {
            return; // 既に初期化済みのアイテムはスキップ
        }
        itemElement.dataset.initialized = 'true'; // 初期化済みフラグを設定

        const dragHandle = itemElement.querySelector('.drag-handle');
        if (dragHandle) {
            enableDragAndDrop(itemElement, dragHandle); 
            console.log(`[initializeSetlistItem] Enabled drag for setlist item with handle: ${itemElement.dataset.itemId}`);
        } else {
            enableDragAndDrop(itemElement); 
            console.log(`[initializeSetlistItem] Enabled drag for album item (no handle): ${itemElement.dataset.itemId}`);
        }
        
        // PCでのダブルクリック機能
        itemElement.addEventListener("dblclick", (e) => {
            // ドラッグハンドル上でない場合のみ削除を実行
            if (!e.target.closest('.drag-handle')) {
                console.log(`[dblclick] PC double-click detected for item: ${itemElement.dataset.itemId}. Removing item.`);
                removeSetlistItem(itemElement);
                e.stopPropagation(); 
                e.preventDefault(); 
            }
        }); 
        console.log(`[initializeSetlistItem] Added dblclick listener to setlist item: ${itemElement.dataset.itemId}`);

        // ★修正2: スマートフォンでのダブルタップ検出ロジックを改善 (isDraggingTouch と currentDraggedItem の確認) ★
        itemElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) { 
                const touch = e.touches[0];
                initialTouchX = touch.clientX;
                initialTouchY = touch.clientY;
                isDraggingTouch = false; 

                const currentTime = new Date().getTime();
                if (currentTime - lastTapTime < DOUBLE_TAP_DELAY) {
                    // ダブルタップ候補の場合、デフォルト動作を防ぐ
                    e.preventDefault(); 
                    console.log("[touchstart] Potential double tap initiated. Preventing default.");
                }
                lastTapTime = currentTime;
            }
        }, { passive: false }); 

        itemElement.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - initialTouchX);
                const deltaY = Math.abs(touch.clientY - initialTouchY);

                if (deltaX > TAP_MOVE_THRESHOLD || deltaY > TAP_MOVE_THRESHOLD) {
                    isDraggingTouch = true;

                }
            }
        });

        itemElement.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();

            if (!isDraggingTouch && !currentDraggedItem && (currentTime - lastTapTime < DOUBLE_TAP_DELAY && currentTime - lastTapTime > 0)) {
                // ドラッグハンドル上でのダブルタップは無視
                if (!e.target.closest('.drag-handle')) {
                    console.log(`[touchend] Confirmed double tap for item: ${itemElement.dataset.itemId}. Removing item.`);
                    removeSetlistItem(itemElement);
                    e.stopPropagation(); 
                    e.preventDefault(); 
                } else {
                    console.log("[touchend] Double tap on drag handle. Ignoring remove.");
                }
            }
            lastTapTime = 0; 
            initialTouchX = 0; 
            initialTouchY = 0;
            isDraggingTouch = false; 
 
        });


        // setlist-item 内のチェックボックスにもイベントリスナーを設定
        itemElement.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation(); // チェックボックスのクリックが親要素に伝播しないように
                const optionType = checkbox.dataset.optionType;
                const slot = checkbox.closest('.setlist-slot'); 

                if (!slot) {
                    console.warn("[checkboxClick] Checkbox clicked but no parent .setlist-slot found.");
                    return;
                }

                if (optionType === 'short') {
                    slot.classList.toggle('short', checkbox.checked);
                    slot.dataset.short = checkbox.checked ? 'true' : 'false';
                    console.log(`[checkboxClick] Slot ${slot.dataset.slotIndex} short status changed to: ${checkbox.checked}`);
                } else if (optionType === 'se') {
                    slot.classList.toggle('se-active', checkbox.checked);
                    slot.dataset.seChecked = checkbox.checked ? 'true' : 'false';
                    console.log(`[checkboxClick] Slot ${slot.dataset.slotIndex} SE status changed to: ${checkbox.checked}`);
                } else if (optionType === 'drumsolo') {
                    slot.classList.toggle('drumsolo-active', checkbox.checked);
                    slot.dataset.drumsoloChecked = checkbox.checked ? 'true' : 'false';
                    console.log(`[checkboxClick] Slot ${slot.dataset.slotIndex} drumsolo status changed to: ${checkbox.checked}`);
                }
            });
        });
    };

    // 既存のアルバムアイテムに初期化関数を適用
    document.querySelectorAll(".album-content .item").forEach(initializeSetlistItem);


    // セットリストのスロットにドロップターゲットとしてのイベントを設定
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        if (!slot.dataset.slotIndex) {
            slot.dataset.slotIndex = index.toString();
        }
        enableDragAndDrop(slot); // スロット自体はドロップターゲットとして機能
        console.log(`[DOMContentLoaded] Enabled drop zone for setlist slot: ${slot.dataset.slotIndex}`);

        slot.addEventListener('click', (e) => {
            // スロット内に setlist-item が存在しない場合のみ処理
            if (!e.target.closest('.setlist-item')) {
                 console.log("[slotClick] Clicked on empty slot or slot background. No action (no item to delete here).");
                 e.stopPropagation(); // クリックイベントの伝播を完全に停止
                 e.preventDefault(); // デフォルトの動作（選択など）も防止
            }
        }, { passive: false }); // preventDefault() を使うため passive: false を指定

        // スロット自体のタッチイベントも強化
        slot.addEventListener('touchstart', (e) => {

            if (!e.target.closest('.setlist-item') && !currentDraggedItem) {
                const touch = e.touches[0];
                initialTouchX = touch.clientX;
                initialTouchY = touch.clientY;
                isDraggingTouch = false; 
                e.preventDefault(); // 空スロットのタップで余計なイベントを防止
                console.log("[slot touchstart] Touch initiated on empty slot. Preventing default.");
            }
        }, { passive: false });

        slot.addEventListener('touchmove', (e) => {
            // setlist-item がスロット内に既にある場合、またはドラッグ中のアイテムがある場合は無視
            if (!e.target.closest('.setlist-item') && !currentDraggedItem) {
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - initialTouchX);
                const deltaY = Math.abs(touch.clientY - initialTouchY);
                if (deltaX > TAP_MOVE_THRESHOLD || deltaY > TAP_MOVE_THRESHOLD) {
                    isDraggingTouch = true;
                    // ドラッグ開始時はスクロールなどを防ぐためpreventDefaultも有効に
                    e.preventDefault(); 
                    console.log("[slot touchmove] Touch moved on empty slot. Preventing default.");
                }
            }
        }, { passive: false });

        slot.addEventListener('touchend', (e) => {
            // setlist-item がスロット内に既にある場合、またはドラッグ中のアイテムがある場合は無視
            if (!e.target.closest('.setlist-item') && !currentDraggedItem) {
                // 空のスロットへのタップ/ドラッグ終了時には、削除処理は一切行わない
                console.log("[slot touchend] Tap/Drag ended on empty slot. No deletion.");
                e.stopPropagation(); // イベント伝播を停止
                e.preventDefault(); // デフォルト動作を防止
            }
            // グローバルなタッチ状態をリセット (これは共通で実行)
            lastTapTime = 0; 
            initialTouchX = 0;
            initialTouchY = 0;
            isDraggingTouch = false;
        }, { passive: false });
    });
    console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots. Double-click for deletion now targets actual song items.");


    // MutationObserver: セットリストへのアイテム追加を監視し、イベントリスナーを設定
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { 
                        if (node.classList.contains('setlist-item')) {
                            initializeSetlistItem(node);
                            console.log(`[MutationObserver] Initialized newly added setlist item: ${node.dataset.itemId}`);
                        }
                        if (node.classList.contains('setlist-slot')) {
                            enableDragAndDrop(node); 
                            const existingItemInSlot = node.querySelector('.setlist-item');
                            if (existingItemInSlot && !existingItemInSlot.dataset.initialized) {
                                initializeSetlistItem(existingItemInSlot);
                            }
                            console.log(`[MutationObserver] Re-checked/initialized slot: ${node.dataset.slotIndex}`);
                        }
                    }
                });
            }
        }
    });

    observer.observe(setlist, { childList: true, subtree: true });
    console.log("[DOMContentLoaded] MutationObserver for #setlist initialized.");


    // --- 日付ドロップダウン、モーダル、セットリストリンク関連の初期設定 (変更なし) ---
    // ここから下のコードは前回のものと同じで変更はありません。
    // 省略...

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    const updateDays = () => {
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
    };

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

    if (setlistYear && setlistMonth && setlistDay) {
        const today = new Date();
        setlistYear.value = today.getFullYear();
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        updateDays(); 
        setlistDay.value = today.getDate().toString().padStart(2, '0');
    }

    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal'); 
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');             
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton'); 

    const open2025FromPastModalButton = document.getElementById('open2025FromPastModalButton'); 
    const year2025DetailModal = document.getElementById('year2025DetailModal');         
    const close2025DetailModalButton = document.getElementById('close2025DetailModalButton'); 

    if (openPastSetlistsModalButton && pastSetlistsModal && closePastSetlistsModalButton) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.add('active'); 
        });

        closePastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.remove('active'); 
        });

        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) { 
                pastSetlistsModal.classList.remove('active');
            }
        });
    }

    if (year2025DetailModal && close2025DetailModalButton) {
        if (open2025FromPastModalButton) {
            open2025FromPastModalButton.addEventListener('click', () => {
                pastSetlistsModal.classList.remove('active'); 
                year2025DetailModal.classList.add('active');  
            });
        }

        close2025DetailModalButton.addEventListener('click', () => {
            year2025DetailModal.classList.remove('active'); 
        });

        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) {
                year2025DetailModal.classList.remove('active');
            }
        });
    }

    document.querySelectorAll('.setlist-link').forEach(link => {
        link.addEventListener('click', (event) => {
            const shareIdMatch = link.href.match(/\?shareId=([^&]+)/);
            if (shareIdMatch) {
                event.preventDefault(); 
                const shareId = shareIdMatch[1];
                const newUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
                
                loadSetlistState().then(() => {
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (year2025DetailModal) year2025DetailModal.classList.remove('active');
                }).catch(error => {
                    console.error("[setlist-link click] Error loading setlist:", error);
                    showMessageBox('セットリストのロードに失敗しました。');
                });
            } else {
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                if (year2025DetailModal) year2025DetailModal.classList.remove('active');
            }
        });
    });

    loadSetlistState().then(() => {
      hideSetlistItemsInMenu();
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu();
    });
});
