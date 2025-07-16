let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムIDを保持 (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
const DRAG_THRESHOLD = 10;

let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
let touchTimeout = null; // setTimeout のIDを保持する変数。初期値をnullに統一。
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap
let originalSetlistSlot = null; // PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す
let initialTouchElement = null; // タッチ開始時の要素を保持

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26;
const menuElement = document.querySelector('.menu'); // ハンバーガーメニュー自体の要素

let currentDropZone = null;
let activeTouchSlot = null; // モバイルでのドロップゾーンハイライト用
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
        const songInfo = element.querySelector('.song-info');
        songName = element.dataset.songName || (songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : '');
        
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

    } else if (element.dataset.itemId) { // クローン要素などの場合 (クローンは常にdata-*属性を持つ)
        songName = element.dataset.songName;
        isCheckedShort = element.dataset.short === 'true'; 
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';
        
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
        slotIndex: element.dataset.slotIndex, 
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
        
        slotToClear.classList.remove(
            'setlist-item', 'item', 'short', 'se-active', 'drumsolo-active', 'placeholder-slot'
        );
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });

        const dataAttributesToRemove = [
            'data-item-id', 'data-song-name', 'data-is-short-version',
            'data-has-se-option', 'data-has-drumsolo-option', 'data-short',
            'data-se-checked', 'data-drumsolo-checked', 'data-r-gt',
            'data-l-gt', 'data-bass', 'data-bpm', 'data-chorus'
        ];
        dataAttributesToRemove.forEach(attr => slotToClear.removeAttribute(attr));

        slotToClear.style.cssText = ''; 
        slotToClear.style.visibility = ''; 

        slotToClear.removeEventListener("dragstart", handleDragStart);
        slotToClear.removeEventListener("touchstart", handleTouchStart);
        slotToClear.removeEventListener("touchmove", handleTouchMove);
        slotToClear.removeEventListener("touchend", handleTouchEnd);
        slotToClear.removeEventListener("touchcancel", handleTouchEnd);
        slotToClear.removeEventListener("dblclick", handleDoubleClick); 

        slotToClear.draggable = false; 
        
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
 * @param {Element} elementToProcess - セットリストから戻す、または削除する対象の要素（元のセットリストスロット要素、またはモバイルのクローン要素など、itemIdを持つもの）
 * @param {boolean} fromSetlistOnly - trueの場合、セットリストからのアイテムのみを処理し、アルバムアイテムは処理しない
 */
function restoreToOriginalList(elementToProcess, fromSetlistOnly = false) {
    const itemId = elementToProcess.dataset.itemId || draggingItemId; 
    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found for restoration. Element:`, elementToProcess);
        if (elementToProcess === currentTouchDraggedClone && elementToProcess.parentNode === document.body) {
            elementToProcess.remove();
            console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body due to missing itemId.");
        }
        return; 
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}. Source element:`, elementToProcess, `fromSetlistOnly: ${fromSetlistOnly}`);

    // アルバムアイテムが元々アルバム内にあった場合のみ、アルバムアイテムの表示を戻す
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    const wasOriginallyInAlbum = albumItemInMenu && albumItemInMenu.style.visibility === 'hidden'; 

    if (albumItemInMenu && !fromSetlistOnly) {
        albumItemInMenu.style.visibility = ''; 
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else if (albumItemInMenu && fromSetlistOnly) {
        console.log(`[restoreToOriginalList] Skipped restoring album item ${itemId} because 'fromSetlistOnly' is true.`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // セットリスト内のスロットをクリアする
    const slotToClearInSetlist = setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${itemId}"]`);
    if (slotToClearInSetlist) {
        console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotToClearInSetlist.dataset.slotIndex}`);
        clearSlotContent(setlist, slotToClearInSetlist.dataset.slotIndex); 
    } else {
        console.log(`[restoreToOriginalList] Item ${itemId} was not in setlist (or slot not found), no setlist slot to clear.`);
    }
    
    // originalAlbumMapからの削除
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
    }, {once: true});
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

    // まず全てのアルバムアイテムを表示状態にする
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
        const songData = getSlotItemData(slot); 
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
        // 空のスロットやテキストスロットも保存対象に含める
        if (slot.classList.contains('setlist-slot-text')) {
            return {
                type: 'text',
                textContent: slot.textContent.trim(),
                slotIndex: slot.dataset.slotIndex
            };
        }
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
 **/
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
      additionalInfoDiv.style.display = '';
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

  slotElement.removeEventListener("dragstart", handleDragStart);
  slotElement.removeEventListener("touchstart", handleTouchStart);
  slotElement.removeEventListener("touchmove", handleTouchMove);
  slotElement.removeEventListener("touchend", handleTouchEnd);
  slotElement.removeEventListener("touchcancel", handleTouchEnd);
  slotElement.removeEventListener("dblclick", handleDoubleClick); 

  slotElement.draggable = true;
  slotElement.addEventListener("dragstart", handleDragStart);
  slotElement.addEventListener("touchstart", handleTouchStart, { passive: false });
  slotElement.addEventListener("touchmove", handleTouchMove, { passive: false });
  slotElement.addEventListener("touchend", handleTouchEnd);
  slotElement.addEventListener("touchcancel", handleTouchEnd);
  slotElement.addEventListener("dblclick", handleDoubleClick);

  console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and events re-attached.`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  const originalElement = event.target.closest(".item") || event.target.closest(".setlist-item");
  if (!originalElement || !originalElement.dataset.itemId) {
    console.warn("[dragstart:PC] No draggable item found or missing itemId.");
    event.preventDefault();
    return;
  }

  draggingItemId = originalElement.dataset.itemId;
  event.dataTransfer.setData("text/plain", draggingItemId);
  event.dataTransfer.effectAllowed = "move";

  if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
    originalSetlistSlot = originalElement;
    originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);

    originalSetlistSlot.style.visibility = 'hidden'; 
    originalSetlistSlot.classList.add('placeholder-slot'); 
    currentPcDraggedElement = originalElement;
    console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);

  } else {
    originalSetlistSlot = null; 
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
  
  if (currentPcDraggedElement) {
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
  event.preventDefault(); // 必要
  const targetSlot = event.target.closest('.setlist-slot');
  
  if (targetSlot) {
    // ドラッグ中のアイテムとターゲットが同じスロットでないことを確認
    if (originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
      // 自身の上に戻る場合はハイライトしない
      return; 
    }
    targetSlot.classList.add('drag-over');
    console.log(`[dragenter] Entered slot: ${targetSlot.dataset.slotIndex}`);
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
    // relatedTargetを使って、子要素への移動ではなく本当にスロットから出た場合にのみクラスを削除
    // event.relatedTarget は、イベントがどの要素からどの要素へ移動したかを示す
    if (!event.relatedTarget || !targetSlot.contains(event.relatedTarget)) {
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
  event.preventDefault(); // preventDefaultがないとdropイベントが発生しない

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  if (!draggingItemId) return;

  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot;

  if (newDropZone) {
    // 元のスロットの上にドラッグバックされた場合、ハイライトしない
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
    }
  } else if (currentDropZone) {
    // スロット外にドラッグされた場合
    currentDropZone.classList.remove('drag-over');
    currentDropZone = null;
  }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ処理
 * @param {Element} draggedElement - ドラッグされた要素（元の要素またはクローン）
 * @param {Element|null} dropTargetSlot - ドロップされたターゲットスロット要素、またはnull
 * @param {Element|null} originalSetlistSlot - セットリストからドラッグされた場合の元のスロット要素
 */
function processDrop(draggedElement, dropTargetSlot, originalSetlistSlot = null) {
    console.log("[processDrop] Initiated. draggedElement:", draggedElement, "dropTargetSlot:", dropTargetSlot, "originalSetlistSlot:", originalSetlistSlot);

    const itemId = draggedElement.dataset.itemId;
    if (!itemId) {
        console.error("[processDrop] draggedElement has no itemId. Aborting processDrop.");
        // もしクローン要素が残っていたら削除
        if (draggedElement === currentTouchDraggedClone && draggedElement.parentNode === document.body) {
            draggedElement.remove();
        }
        // ★エラー時もクリーンアップを呼ぶべき
        finishDragging(); 
        return;
    }

    let draggedItemData = null;
    if (originalSetlistSlot && originalSetlistSlot._originalItemData) {
        draggedItemData = originalSetlistSlot._originalItemData;
        console.log("[processDrop] Using _originalItemData from originalSetlistSlot:", draggedItemData);
    } else {
        draggedItemData = getSlotItemData(draggedElement);
        // アルバムからのドラッグの場合、元のアルバムアイテムのオプション情報を引き継ぐ
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
        // ★エラー時もクリーンアップを呼ぶべき
        finishDragging(); 
        return;
    }

    const isDraggedFromSetlist = originalSetlistSlot !== null;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    if (dropTargetSlot) {
        // ドロップ先が元のスロットと同じ場合は、何もしないで元の状態に戻す
        if (isDraggedFromSetlist && dropTargetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            console.log("[processDrop] Dropped back to original slot. No change.");
            // visibility hidden になっている元のスロットを再表示
            if (originalSetlistSlot) {
                originalSetlistSlot.style.visibility = '';
                originalSetlistSlot.classList.remove('placeholder-slot');
                if (originalSetlistSlot._originalItemData) {
                    delete originalSetlistSlot._originalItemData;
                }
            }
            // ★この場合もクリーンアップは必要
            finishDragging();
            return;
        }

        if (isDraggedFromSetlist) {
            // セットリスト内での移動 or セットリスト内のアイテムを空きスロットへ移動
            if (dropTargetSlot.classList.contains('setlist-item')) {
                // スワップ処理
                console.log(`[processDrop] Swapping items. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                const targetSlotItemData = getSlotItemData(dropTargetSlot);
                if (targetSlotItemData) {
                    clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
                    fillSlotWithItem(originalSetlistSlot, targetSlotItemData);
                }
                clearSlotContent(setlist, dropTargetSlot.dataset.slotIndex); // ターゲットスロットをクリア
                fillSlotWithItem(dropTargetSlot, draggedItemData); // クリアしたターゲットスロットにドラッグされたアイテムを入れる
            } else {
                // セットリスト内のアイテムを空のスロットに移動
                console.log(`[processDrop] Moving item within setlist to empty slot. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex); // 元のスロットをクリア
                fillSlotWithItem(dropTargetSlot, draggedItemData); // ターゲットスロットにドラッグされたアイテムを入れる
            }
        } else {
            // アルバムからのドロップ
            if (dropTargetSlot.classList.contains('setlist-item')) {
                showMessageBox('このスロットはすでに埋まっています。');
                restoreToOriginalList(draggedElement, false); // アルバムアイテムを元に戻す
                // ★この場合もクリーンアップは必要
                finishDragging();
                return;
            }

            const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
            if (currentSongCount >= maxSongs) {
                showMessageBox('セットリストは最大曲数に達しています。');
                restoreToOriginalList(draggedElement, false); // アルバムアイテムを元に戻す
                // ★この場合もクリーンアップは必要
                finishDragging();
                return;
            }

            console.log(`[processDrop] Adding item from album. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
            fillSlotWithItem(dropTargetSlot, draggedItemData);
            // アルバムリスト内の元のアイテムを非表示にする
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItem) {
                albumItem.style.visibility = 'hidden'; 
            }
        }
    } else {
        // ドロップターゲットがない（セットリスト外にドロップされた）
        console.log("[processDrop] Dropped outside setlist.");
        if (isDraggedFromSetlist) {
            // セットリストからドラッグされたアイテムを、セットリストから削除
            console.log(`[processDrop] Item from setlist (${itemId}) dropped outside. Clearing original slot.`);
            clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
            restoreToOriginalList(draggedElement, true); // アルバムアイテムは表示しない
        } else {
            // アルバムからドラッグされたアイテムを、元のアルバムリストに戻す
            console.log(`[processDrop] Album item (${itemId}) dropped outside. Restoring to original list.`);
            restoreToOriginalList(draggedElement, false);
        }
    }
    
    // ★重要: ドロップ処理の成功・失敗に関わらず、最後に必ず finishDragging() を呼び出す
    console.log("[processDrop] Calling finishDragging.");
    finishDragging(); 
    console.log("[processDrop] Function end.");
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
  event.preventDefault(); // ドロップのデフォルト動作を防ぐ
  console.log("[handleDrop] Drop event fired.");
  const droppedItemId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : draggingItemId;
  console.log(`[handleDrop] droppedItemId: "${droppedItemId}"`);
  
  let draggedItem;
  // PCドラッグの場合は currentPcDraggedElement、モバイルドラッグの場合は currentTouchDraggedClone を使用
  if (currentPcDraggedElement && currentPcDraggedElement.dataset.itemId === droppedItemId) {
      draggedItem = currentPcDraggedElement;
      console.log("[handleDrop] Using currentPcDraggedElement as draggedItem.");
  } else if (currentTouchDraggedClone && currentTouchDraggedClone.dataset.itemId === droppedItemId) {
      draggedItem = currentTouchDraggedClone;
      console.log("[handleDrop] Using currentTouchDraggedClone as draggedItem.");
  } else {
      // フォールバック: アルバムリスト内から元の要素を探す
      draggedItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
      console.log("[handleDrop] Searched for draggedItem in album content by ID as fallback.");
  }

  if (!draggedItem) {
    console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". This can happen if the element was moved or removed unexpectedly before drop.");
    finishDragging(); // クリーンアップだけ実行
    return;
  }
  console.log("[handleDrop] draggedItem found:", draggedItem);

  // ドロップされた正確な座標から要素を取得し、最も近いセットリストスロットを探す
  const dropTargetSlot = event.target.closest('.setlist-slot');
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

  // processDrop関数にロジックを委譲
  processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
  
  finishDragging(); // ドラッグ終了後のクリーンアップ処理
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ開始時の処理
 */
function handleTouchStart(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    if (closestCheckbox) {
        console.log("[touchstart] Checkbox clicked directly. Allowing native behavior.");
        lastTapTime = 0;
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        isDragging = false;
        return;
    }

    const touchedElement = event.target.closest(".setlist-item") || event.target.closest(".item");
    if (!touchedElement || !touchedElement.dataset.itemId) {
        console.warn("[touchstart] No valid draggable item found on touch start. Aborting.");
        return;
    }

    initialTouchElement = touchedElement;
    draggingItemId = touchedElement.dataset.itemId;
    
    const isInSetlist = setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item');
    const isInAlbumContent = touchedElement.closest('.album-content') && touchedElement.classList.contains('item');

    // ★最重要: ドラッグ可能な要素をタッチしたら、まずデフォルトの動作（スクロールなど）を抑制する
    // これにより、長押しタイマーが発火するまでの間に指が動いてもスクロールと誤認識されません。
    event.preventDefault(); 
    console.log("[touchstart] Prevented default for all draggable item touches.");

    // --- 1. ダブルタップ検出ロジック (最優先で処理し、処理後は即リターン) ---
    if (tapLength < 300 && tapLength > 0) {
        console.log("[touchstart] Double tap detected.");
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        event.stopPropagation(); 

        // ★ここを修正します★
        // セットリスト内のアイテムのダブルタップは、アルバムに戻さないように変更
        // if (isInSetlist) {
        //     console.log("[touchstart] Double tap on setlist item. Moving to menu.");
        //     restoreToOriginalList(touchedElement, false);
        //     showMessageBox('曲をセットリストから削除しました。');
        // } else 
        if (isInAlbumContent) { // アルバムからのダブルタップのみ処理
            console.log("[touchstart] Double tap on album item. Adding to setlist.");
            const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
            if (!emptySlot) {
                showMessageBox('セットリストは最大曲数に達しています。');
            } else if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${touchedElement.dataset.itemId}"]`)) {
                const originalList = touchedElement.parentNode;
                originalAlbumMap.set(touchedElement.dataset.itemId, originalList ? originalList.id : null);
                touchedElement.style.visibility = 'hidden';
                const itemData = getSlotItemData(touchedElement);
                if (itemData) {
                    fillSlotWithItem(emptySlot, itemData);
                    showMessageBox('曲をセットリストに追加しました。');
                }
            } else {
                showMessageBox('この曲はすでにセットリストにあります。');
            }
        } else {
            console.warn("[touchstart] Double tap on unrecognized element for specific action.");
        }
        
        lastTapTime = 0;
        isDragging = false;
        draggingItemId = null;
        currentTouchDraggedClone = null;
        originalSetlistSlot = null;
        currentDropZone = null;
        finishDragging();
        return; // ダブルタップ処理が実行されたら、ここで関数を終了
    }
    lastTapTime = currentTime;

    // --- 2. シングルタッチからの長押し（ドラッグ開始）処理 ---
    if (event.touches.length === 1) {
        isDragging = false; 

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }

        if (isInSetlist || isInAlbumContent) {
            originalSetlistSlot = isInSetlist ? touchedElement : null;
            
            console.log(`[touchstart] Setting long press timer for drag. From setlist: ${!!originalSetlistSlot}`);

            touchTimeout = setTimeout(() => {
                // タイマー発火時にisDraggingがまだfalseであることを確認
                if (!isDragging && draggingItemId && document.body.contains(initialTouchElement)) {
                    createTouchDraggedClone(initialTouchElement, touchStartX, touchStartY, draggingItemId);
                    isDragging = true; // ドラッグ状態に移行
                    console.log("[touchstart] Dragging initiated after timeout.");
                } else {
                    console.warn("[touchstart] Dragging not initiated after timeout (condition unmet or already dragging).");
                }
                touchTimeout = null;
            }, 600);
        } else {
            console.log("[touchstart] Touched element is not a recognized draggable item for long press. Aborting.");
            // ドラッグ対象外の要素なら処理を終了
            return;
        }
    }
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    const touch = event.touches[0];
    if (!touch) {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        return;
    }

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
    }
    
    event.preventDefault(); 
    event.stopPropagation();
    
    rafId = requestAnimationFrame(() => {
        const currentX = touch.clientX;
        const currentY = touch.clientY;

        // ドラッグがまだ開始されていない場合 (isDraggingがfalse)
        if (!isDragging) {
            const deltaX = Math.abs(currentX - touchStartX);
            const deltaY = Math.abs(currentY - touchStartY);
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    touchTimeout = null; // ロングプレスをキャンセル
                    console.log("[handleTouchMove] Movement beyond threshold, cancelling long press timer.");
                }
            }
            rafId = null;
            return; // ドラッグが始まっていないので、これ以上処理しない
        }
        if (!currentTouchDraggedClone) {
            console.warn("[handleTouchMove] Dragging clone is null, but isDragging is true. Aborting move.");
            rafId = null;
            return;
        }
        
        const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
        currentTouchDraggedClone.style.left = (currentX - cloneRect.width / 2) + 'px';
        currentTouchDraggedClone.style.top = (currentY - cloneRect.height / 2) + 'px';

        const targetElement = document.elementFromPoint(currentX, currentY);
        const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

        // セットリスト内移動で、元のスロットに戻った場合はハイライトしない
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
        }

        rafId = null;
    });
}



/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理
 */
function handleTouchEnd(event) {
    console.log("[touchEnd] Touch end detected. isDragging:", isDragging, "currentTouchDraggedClone:", !!currentTouchDraggedClone);

    if (touchTimeout) { // 長押しタイマーがまだアクティブならクリア
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchEnd] Cleared pending long press timer.");
    }

    // ★重要: isDraggingがtrueの場合のみprocessDropを呼び出す
    if (isDragging && currentTouchDraggedClone) { 
        console.log("[touchEnd] Dragging was active. Processing drop.");
        event.preventDefault(); // ここでも念のためデフォルト動作を防ぐ

        // モバイルドロップターゲットの特定
        const touch = event.changedTouches[0]; // 指が離れた位置を取得
        let dropTargetSlot = null;
        if (touch) {
            const targetElementAtDrop = document.elementFromPoint(touch.clientX, touch.clientY);
            dropTargetSlot = targetElementAtDrop ? targetElementAtDrop.closest('.setlist-slot') : null;
        }

        // processDrop に適切な引数を渡す
        // draggedElement にはクローン要素、dropTargetSlot、originalSetlistSlot を渡す
        processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
    } else {
        // ドラッグが開始されていなかった（＝単に長押し後に離した）場合のクリーンアップ
        console.log("[touchEnd] No active drag or drag not initiated, performing cleanup only.");
        finishDragging(); 
    }
    console.log("[touchEnd] Function end.");
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

    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body.");
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // クラスコピー (Datasetコピーで大部分はカバーされるが、明示的に追加)
    if (originalElement.classList.contains('short')) {
        currentTouchDraggedClone.classList.add('short');
    }
    if (originalElement.classList.contains('se-active')) {
        currentTouchDraggedClone.classList.add('se-active');
    }
    if (originalElement.classList.contains('drumsolo-active')) {
        currentTouchDraggedClone.classList.add('drumsolo-active');
    }
    Array.from(originalElement.classList).forEach(cls => {
        if (cls.startsWith('album')) {
            currentTouchDraggedClone.classList.add(cls);
        }
    });

    // dataset コピー
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; // 念のため再設定

    document.body.appendChild(currentTouchDraggedClone);

    // ✅ セットリスト内のアイテムだった場合、元の要素を隠してプレースホルダーにする
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalElement); // 元のデータを保存
        originalSetlistSlot.classList.add('placeholder-slot');
        originalSetlistSlot.style.visibility = 'hidden'; // 元のスロットを非表示
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else {
        originalElement.style.visibility = 'hidden'; 
        originalSetlistSlot = null; // アルバムアイテムからのドラッグの場合、元のスロットはない
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録 (重複していても問題なし)
    if (!originalAlbumMap.has(itemIdToClone)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId);
    }

    // クローンの位置調整
    const rect = originalElement.getBoundingClientRect();
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = rect.width + 'px';
    currentTouchDraggedClone.style.height = rect.height + 'px';
    currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クリックイベントを透過させる

    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグで元の要素に "dragging" クラスがついていれば削除
  if (currentPcDraggedElement) {
    currentPcDraggedElement.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class for PC element: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }

  // モバイルドラッグのクローン要素を削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null;

  // originalSetlistSlot がプレースホルダー状態であれば、一時的なスタイルを解除し、元の表示に戻す
  if (originalSetlistSlot) {
      originalSetlistSlot.classList.remove('placeholder-slot');
      originalSetlistSlot.style.visibility = ''; // 必ずvisibilityを元に戻す
      if (originalSetlistSlot._originalItemData) {
          delete originalSetlistSlot._originalItemData;
      }
      console.log(`[finishDragging] Restored visibility and removed placeholder from originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex || 'N/A'}.`);
  }

  // ドロップゾーンのハイライトをすべて解除
  setlist.querySelectorAll('.setlist-slot.drag-over')
    .forEach(slot => {
        slot.classList.remove('drag-over');
        slot.classList.remove('active-drop-target'); // 念のため
        slot.style.opacity = ''; // 念のためスタイルもリセット
    });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // グローバル変数をリセット
  currentDropZone = null;
  activeTouchSlot = null;
  currentPcDraggedElement = null;
  draggingItemId = null; 
  isDragging = false; // これが重要
  originalSetlistSlot = null; // リセット

  // タイムアウトやアニメーションフレームがあればクリア
  if (touchTimeout) { 
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) { 
      cancelAnimationFrame(rafId);
      rafId = null;
  }

  // セットリストにあるアイテムをアルバムメニューから隠す最終処理
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
    // モバイルデバイスからのdblclickイベントは完全に無視
    const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini|Windows Phone/i.test(navigator.userAgent);
    if (isMobileDevice) {
        // console.log("[handleDoubleClick] Ignoring dblclick on mobile, handled by touch events."); // デバッグ用に残すことも可能
        finishDragging(); // 念のためクリーンアップ
        return;
    }

    const item = event.target.closest(".item") || event.target.closest(".setlist-slot.setlist-item");
    if (!item || !item.dataset.itemId) {
        console.log("[handleDoubleClick] No valid item found for double click.");
        finishDragging();
        return;
    }

    event.preventDefault(); // デフォルト動作を防ぐ
    event.stopPropagation(); // イベントのバブリングを停止
    console.log(`[handleDoubleClick] Double click (PC) on item ID: ${item.dataset.itemId}`);

    const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

    if (isInsideSetlist) {
        // ✅ PCからのダブルクリック: セットリストからハンバーガーメニューに戻す (維持)
        console.log("[handleDoubleClick] PC: Item is in setlist. Restoring to original list.");
        restoreToOriginalList(item);
        showMessageBox('曲をセットリストから削除しました。');
    } else {
        // ✅ PCからのダブルクリック: アルバムからセットリストへ追加 (維持)
        console.log("[handleDoubleClick] PC: Item is in album list. Attempting to add to setlist.");
        const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
        
        if (!emptySlot) {
            showMessageBox('セットリストは最大曲数に達しています。');
            console.log("[handleDoubleClick] PC: Setlist is full.");
        } else if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
            const originalList = item.parentNode;
            originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null); 
            item.style.visibility = 'hidden';
            const itemData = getSlotItemData(item);
            if (itemData) {
                fillSlotWithItem(emptySlot, itemData);
                showMessageBox('曲をセットリストに追加しました。');
            } else {
                console.error("[handleDoubleClick] PC: Failed to get item data for double clicked album item.");
            }
        } else {
            showMessageBox('この曲はすでにセットリストにあります。');
            console.log(`[handleDoubleClick] PC: Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
        }
    }
    finishDragging(); // ドロップ/ダブルクリック操作後のクリーンアップ
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    if (element.classList.contains('item')) {
        // itemId がなければ生成 (既存のアルバムアイテムには data-item-id があるはずなので主に新規追加用)
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) {
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true; // PCドラッグを許可

        // イベントリスナーは追加前に既存のものを削除して重複を防ぐ
        element.removeEventListener("dragstart", handleDragStart);
        element.removeEventListener("touchstart", handleTouchStart);
        element.removeEventListener("touchmove", handleTouchMove);
        element.removeEventListener("touchend", handleTouchEnd);
        element.removeEventListener("touchcancel", handleTouchEnd);
        element.removeEventListener("dblclick", handleDoubleClick); // Double click for album items

        element.addEventListener("dragstart", handleDragStart);
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
        element.addEventListener("dblclick", handleDoubleClick); // ダブルクリックでセットリスト追加

    } else if (element.classList.contains('setlist-slot')) {
        // セットリストスロットはドロップターゲットとしてのみ機能させる
        element.removeEventListener("dragover", handleDragOver);
        element.removeEventListener("drop", handleDrop);
        element.removeEventListener("dragenter", handleDragEnter);
        element.removeEventListener("dragleave", handleDragLeave);

        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
    }
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

        const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

        let shareTextHeader = '';
        if (currentState.setlistDate) {
            shareTextHeader += `日付: ${currentState.setlistDate}\n`;
        }
        if (currentState.setlistVenue) {
            shareTextHeader += `会場: ${currentState.setlistVenue}\n`;
        }
        if (shareTextHeader) {
            shareTextHeader += '\n'; // ヘッダーがある場合は2行改行
        }

        let songListText = "";
        let itemNo = 1; 

        if (currentState.setlist.length > 0) {
            songListText = currentState.setlist.map(itemData => {
                if (itemData.type === 'text') {
                    return itemData.textContent; // テキストスロットはそのまま出力
                }

                let titleText = itemData.name || '';
                if (itemData.short) {
                    titleText += ' (Short)';
                }
                if (itemData.seChecked) {
                    titleText += ' (SE有り)';
                }
                if (itemData.drumsoloChecked) {
                    titleText += ' (ドラムソロ有り)';
                }

                const isAlbum1 = itemData.itemId && album1ItemIds.includes(itemData.itemId);

                let line = '';
                if (isAlbum1) {
                    line = `    ${titleText}`; // 4つの半角スペースでインデント
                } else {
                    line = `${itemNo}. ${titleText}`;
                    itemNo++; 
                }
                return line;
            }).join("\n");
        }
        
        const fullShareText = shareTextHeader + songListText;

        if (navigator.share) {
            navigator.share({
                text: fullShareText, // 日付・会場情報とセットリスト全体
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

    const tableBody = []; // 詳細PDF用
    const simplePdfBody = []; // シンプルPDF用

    let detailedItemNo = 1; 
    let simpleItemNoForNumberedList = 1; // シンプルPDFの連番用（album1以外）

    // album1として扱うdata-item-idのリスト
    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

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

                const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                // --- 詳細PDF用の行の生成 ---
                let currentDetailedItemNo = '';
                if (!isAlbum1) { // album1でなければ連番を振る
                    currentDetailedItemNo = detailedItemNo.toString();
                    detailedItemNo++;
                }
                const detailedRow = [
                    currentDetailedItemNo,
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
                    simplePdfBody.push(`    ${titleText}`); // インデント
                } else {
                    simplePdfBody.push(`${simpleItemNoForNumberedList}. ${titleText}`);
                    simpleItemNoForNumberedList++; // album1以外の曲の場合のみ連番をインクリメント
                }
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                // 詳細PDF用の行 (テキストスロットはNo.なし、タイトル列に全文)
                tableBody.push([textContent, '', '', '', '', '', '']); 
                // シンプルPDF用の行 (テキストスロットはNo.なし、そのまま追加)
                simplePdfBody.push(textContent);
            }
        }
    }

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
                fontStyle: 'normal', 
                fontSize: 10,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                font: 'NotoSansJP',
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' }, // No.
                1: { cellWidth: 72, halign: 'left' },   // タイトル
                2: { cellWidth: 22, halign: 'center' }, // R.Gt
                3: { cellWidth: 22, halign: 'center' }, // L.Gt
                4: { cellWidth: 22, halign: 'center' }, // Bass
                5: { cellWidth: 18, halign: 'center' }, // BPM
                6: { cellWidth: 22, halign: 'center' }  // コーラス
            },
            margin: { top: topMargin, right: 10, bottom: 10, left: leftMargin },
            didDrawPage: function (data) {
                let str = 'Page ' + detailedPdf.internal.getNumberOfPages();
                detailedPdf.setFontSize(10);
                detailedPdf.setFont('NotoSansJP', 'normal');
                detailedPdf.text(str, detailedPdf.internal.pageSize.getWidth() - 10, detailedPdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            },
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

        await new Promise(resolve => setTimeout(resolve, 500)); // 少し待つ

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf); // フォント登録

        simplePdf.setFont('NotoSansJP', 'bold'); // シンプルは常に太字
       
        const simpleFontSize = 19; // さらに大きく
        simplePdf.setFontSize(simpleFontSize); 

        const simpleTopMargin = 25; // 上部マージン
        let simpleYPos = simpleTopMargin;

        const simpleLeftMargin = 25; // 左マージン

        // ヘッダーテキスト（日付と会場）
        if (headerText) {
            simplePdf.setFontSize(simpleFontSize * 1.2); // ヘッダーは曲名より大きく
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 0.8; // ヘッダーと曲リストの間の余白を大幅に増やす
            simplePdf.setFontSize(simpleFontSize); // 曲リスト用に戻す
        }

        // 各曲目をテキストとして追加
        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 0.5; // 行の高さを調整

            // ページ下部に近づいたら新しいページを追加
            const bottomMarginThreshold = simpleTopMargin - 10; // 下部マージン
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

            // 既存のセットリストをクリア
            for (let i = 0; i < maxSongs; i++) {
              clearSlotContent(setlist, i.toString());
            }
            // アルバムアイテムの表示状態をリセット
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.visibility = '';
            });
            // originalAlbumMap をクリア
            originalAlbumMap.clear();
            console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

            // originalAlbumMap を復元
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

            // 日付の復元
            if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                const dateParts = state.setlistDate.split('-'); 
                if (dateParts.length === 3) {
                    setlistYear.value = dateParts[0];
                    setlistMonth.value = dateParts[1];
                    
                    if (typeof updateDays === 'function') {
                        updateDays(); // 月が変わったら日を更新
                    } else {
                        console.warn("[loadSetlistState] updateDays function is not defined. Day dropdown might not be correctly populated.");
                    }
                    setlistDay.value = dateParts[2];

                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found. Initializing to today.");
                // 日付が保存されていない、または要素がない場合は今日の日付を設定
                if (setlistYear) setlistYear.value = new Date().getFullYear();
                if (setlistMonth) setlistMonth.value = (new Date().getMonth() + 1).toString().padStart(2, '0');
                if (typeof updateDays === 'function') updateDays(); // `updateDays` は DOMContentLoaded で初期化されているはず
                if (setlistDay) setlistDay.value = new Date().getDate().toString().padStart(2, '0');
            }
            // 会場の復元
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            // セットリストアイテムの復元
            state.setlist.forEach(itemData => {
                if (itemData.type === 'text') {
                    // テキストスロットの復元
                    const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
                    if (targetSlot) {
                        targetSlot.textContent = itemData.textContent;
                        targetSlot.classList.add('setlist-slot-text');
                        console.log(`[loadSetlistState] Filled text slot ${itemData.slotIndex} with "${itemData.textContent}"`);
                    }
                } else {
                    // 曲アイテムの復元
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
                }
            });

            // メニューとアルバムの開閉状態を復元
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
      console.log("[loadSetlistState] No shareId found in URL. Loading default state (today's date).");
      const setlistYear = document.getElementById('setlistYear');
      const setlistMonth = document.getElementById('setlistMonth');
      const setlistDay = document.getElementById('setlistDay');
      if (setlistYear && setlistMonth && setlistDay) {
          const today = new Date();
          setlistYear.value = today.getFullYear();
          setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
          if (typeof updateDays === 'function') { // updateDays はDOMContentLoadedで定義される
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

document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop and date pickers.");

    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    // 日のドロップダウンを更新する関数
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
    // updateDays 関数をグローバルスコープで利用できるようにする
    window.updateDays = updateDays;

    // 年のドロップダウンを生成
    if (setlistYear) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear + 5; i >= currentYear - 30; i--) { 
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            setlistYear.appendChild(option);
        }
        console.log("[Date Init] Years generated.");
    } else {
        console.error("[Date Init Error] setlistYear element not found.");
    }

    // 月のドロップダウンを生成
    if (setlistMonth) {
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i;
            setlistMonth.appendChild(option);
        }
        console.log("[Date Init] Months generated.");
    } else {
        console.error("[Date Init Error] setlistMonth element not found.");
    }

    // 年と月が変更されたら日を再生成
    if (setlistYear) setlistYear.addEventListener('change', updateDays);
    if (setlistMonth) setlistMonth.addEventListener('change', updateDays);

    // デフォルトで今日の日付を選択状態にする（初回ロード時にloadSetlistStateで上書きされる可能性あり）
    if (setlistYear && setlistMonth && setlistDay) {
        const today = new Date();
        setlistYear.value = today.getFullYear();
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        updateDays(); 
        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[DOMContentLoaded] Set setlist date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[DOMContentLoaded] Date select elements (year, month, day) not fully found. Skipping auto-set date.");
    }

    // アルバムアイテムにドラッグ＆ドロップイベントを設定
    document.querySelectorAll(".album-content .item").forEach((item) => {
      enableDragAndDrop(item);
      console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId || 'N/A'}`);
    });

    // セットリストのスロットにドロップターゲットとしてのイベントを設定
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
      if (!slot.dataset.slotIndex) {
          slot.dataset.slotIndex = index.toString();
      }
      enableDragAndDrop(slot); // ドロップターゲットとしてのイベントを設定

      // スロット全体のクリックリスナー（チェックボックス用）
      slot.addEventListener('click', (e) => {
          const checkbox = e.target.closest('input[type="checkbox"]');
          if (checkbox) {
              console.log("[slotClick] Checkbox clicked via slot listener.");
              e.stopPropagation(); // イベントのバブリングを停止
              
              const optionType = checkbox.dataset.optionType;

              if (optionType === 'short') {
                  slot.classList.toggle('short', checkbox.checked);
                  slot.dataset.short = checkbox.checked ? 'true' : 'false';
              } else if (optionType === 'se') {
                  slot.classList.toggle('se-active', checkbox.checked);
                  slot.dataset.seChecked = checkbox.checked ? 'true' : 'false';
              } else if (optionType === 'drumsolo') {
                  slot.classList.toggle('drumsolo-active', checkbox.checked);
                  slot.dataset.drumsoloChecked = checkbox.checked ? 'true' : 'false';
              }
              console.log(`[slotClick] Slot ${slot.dataset.slotIndex} ${optionType} status changed to: ${checkbox.checked}`);
              
              lastTapTime = 0; // チェックボックスクリック時はダブルタップ判定をリセット
              if (touchTimeout) {
                  clearTimeout(touchTimeout);
                  touchTimeout = null;
              }
          }
      });
      // セットリストスロットが中身を持つ場合、fillSlotWithItemでdragstart, touchstart, dblclickも設定される

    });
    console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

    // 共有IDがあればセットリストをロード
    loadSetlistState().then(() => {
      console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
      hideSetlistItemsInMenu(); // ロード後にメニュー内のアイテムを隠す
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu();
    });
    
    // 過去セットリストモーダル関連の要素を取得
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');
    const closeModalButton = pastSetlistsModal ? pastSetlistsModal.querySelector('.close-button') : null;
    const pastYearItems = pastSetlistsModal ? pastSetlistsModal.querySelectorAll('.past-year-item') : [];

    // 2025年詳細モーダル関連の要素を取得
    const year2025DetailModal = document.getElementById('year2025DetailModal');
    const close2025DetailModalButton = year2025DetailModal ? year2025DetailModal.querySelector('.close-button') : null;
    const setlistLinks = year2025DetailModal ? year2025DetailModal.querySelectorAll('.setlist-link') : [];

    // 「過去セットリスト」ボタンのイベントリスナー
    if (openPastSetlistsModalButton && pastSetlistsModal) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            if (menu.classList.contains('open')) {
                toggleMenu(); // ハンバーガーメニューが開いていたら閉じる
            }
            pastSetlistsModal.style.display = 'flex';
            console.log("[pastSetlists] Past Setlists modal opened. Hamburger menu closed.");
        });
    } else {
        console.warn("[DOMContentLoaded] 'Open Past Setlists Modal' button or modal not found.");
    }

    // 過去セットリストモーダルの閉じるボタンのイベントリスナー
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            pastSetlistsModal.style.display = 'none';
            console.log("[pastSetlists] Past Setlists modal closed.");
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log("[pastSetlists] Restored hamburger menu to open state.");
        });
    }

    // 過去セットリストモーダルのオーバーレイクリックイベント
    if (pastSetlistsModal) {
        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) {
                pastSetlistsModal.style.display = 'none';
                console.log("[pastSetlists] Past Setlists modal closed by overlay click.");
                toggleMenu(); // ハンバーガーメニューを再度開く
                console.log("[pastSetlists] Restored hamburger menu to open state after overlay click.");
            }
        });
    }

    // 各年ボタンへのイベントリスナー（モーダル内のボタン）
    pastYearItems.forEach(yearButton => {
        yearButton.addEventListener('click', (event) => {
            const year = event.target.dataset.year;
            console.log(`[pastSetlists] Clicked on year: ${year} in modal.`);

            if (year === '2025') {
                pastSetlistsModal.style.display = 'none'; // 既存のモーダルを閉じる
                if (year2025DetailModal) {
                    year2025DetailModal.style.display = 'flex'; // 新しいモーダルを表示
                    console.log("[pastSetlists] Showing 2025 detail modal.");
                } else {
                    console.warn("[pastSetlists] 2025 detail modal element not found.");
                    showMessageBox('2025年の詳細セットリストモーダルが見つかりません。');
                }
            } else {
                showMessageBox(`${year}年のセットリストを読み込む機能を実装予定です！`);
                pastSetlistsModal.style.display = 'none'; // モーダルを閉じる
                toggleMenu(); // ハンバーガーメニューを再度開く
                console.log("[pastSetlists] Restored hamburger menu to open state after year selection.");
            }
        });
    });

    // 2025年詳細モーダルの閉じるボタンのイベントリスナー
    if (close2025DetailModalButton) {
        close2025DetailModalButton.addEventListener('click', () => {
            year2025DetailModal.style.display = 'none'; // 詳細モーダルを非表示
            console.log("[pastSetlists] 2025 detail modal closed.");
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log("[pastSetlists] Restored hamburger menu to open state after 2025 detail modal closed.");
        });
    }

    // 2025年詳細モーダルのオーバーレイクリックイベント
    if (year2025DetailModal) {
        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) {
                year2025DetailModal.style.display = 'none';
                console.log("[pastSetlists] 2025 detail modal closed by overlay click.");
                toggleMenu();
                console.log("[pastSetlists] Restored hamburger menu to open state after 2025 detail modal overlay click.");
            }
        });
    }

    // 2025年詳細モーダル内の各セットリストリンクのイベントリスナー
    setlistLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // リンクのデフォルト動作（ページ遷移）をキャンセル
            const date = link.dataset.setlistDate;
            const venue = link.dataset.setlistVenue;
            showMessageBox(`${date} ${venue} のセットリストを読み込む機能を実装予定です！`);
            year2025DetailModal.style.display = 'none'; // 詳細モーダルを閉じる
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log(`[pastSetlists] Clicked on setlist link: ${date} ${venue}.`);
        });
    });
});