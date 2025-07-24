// グローバル変数は変更なし
let currentPcDraggedElement = null;
let currentTouchDraggedClone = null;
let draggingItemId = null;
let initialTouchX = 0;
let initialTouchY = 0;
const DRAG_THRESHOLD = 50;
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
        songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : element.dataset.songName;

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

    } else if (element.dataset.itemId) { // クローン要素などの場合
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
        slotIndex: element.dataset.slotIndex, // slotIndex はセットリストアイテムにのみ存在する可能性
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

        slotToClear.style.cssText = '';
        slotToClear.style.visibility = ''; // ここでvisibilityを戻す

        // enableDragAndDropでイベントリスナーを再設定するため、ここで削除は不要
        // むしろ、スロット自体のdragover/dropイベントは残しておくべき
        // slotToClear.removeEventListener("dragstart", handleDragStart); // itemクラスがなくなるので不要
        // slotToClear.removeEventListener("touchstart", handleTouchStart); // itemクラスがなくなるので不要
        // slotToClear.removeEventListener("touchmove", handleTouchMove);
        // slotToClear.removeEventListener("touchend", handleTouchEnd);
        // slotToClear.removeEventListener("touchcancel", handleTouchEnd);
        // slotToClear.draggable = false; // itemクラスがなくなるので不要

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
 */
function restoreToOriginalList(elementToProcess) {
    const itemId = elementToProcess.dataset.itemId || draggingItemId;
    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found for restoration. Element:`, elementToProcess);
        if (elementToProcess === currentTouchDraggedClone && elementToProcess.parentNode === document.body) {
            elementToProcess.remove();
            console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body.");
        }
        return;
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}. Source element:`, elementToProcess);

    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.visibility = '';
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

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

  Array.from(slotElement.classList).forEach(cls => {
    if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active' || cls === 'placeholder-slot') {
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

  const addOptionCheckbox = (optionType, isChecked, labelText) => {
    if (songData[`has${optionType.charAt(0).toUpperCase() + optionType.slice(1)}Option`]) {
      const checkboxWrapper = document.createElement('span');
      checkboxWrapper.classList.add('checkbox-wrapper');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.dataset.optionType = optionType;
      checkbox.addEventListener('change', function() {
          const slot = this.closest('.setlist-slot');
          const dataToUpdate = getSlotItemData(slot);
          if (optionType === 'short') {
              dataToUpdate.short = this.checked;
              slot.classList.toggle('short', this.checked);
              slot.dataset.short = this.checked ? 'true' : 'false';
          } else if (optionType === 'se') {
              dataToUpdate.seChecked = this.checked;
              slot.classList.toggle('se-active', this.checked);
              slot.dataset.seChecked = this.checked ? 'true' : 'false';
          } else if (optionType === 'drumsolo') {
              dataToUpdate.drumsoloChecked = this.checked;
              slot.classList.toggle('drumsolo-active', this.checked);
              slot.dataset.drumsoloChecked = this.checked ? 'true' : 'false';
          }
          saveSetlistState();
          console.log(`[checkbox change] Item ${dataToUpdate.itemId} ${optionType} option changed to ${this.checked}.`);
      });
      checkboxWrapper.appendChild(checkbox);
      const label = document.createElement('span');
      label.textContent = labelText;
      label.classList.add(`${optionType}-label`);
      checkboxWrapper.appendChild(label);
      songNameAndOptionDiv.appendChild(checkboxWrapper);
    }
  };

  addOptionCheckbox('short', isCurrentlyCheckedShort, '(Short)');
  addOptionCheckbox('se', isCurrentlyCheckedSe, '(SE有り)');
  addOptionCheckbox('drumsolo', isCurrentlyCheckedDrumsolo, '(ドラムソロ有り)');

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

  // ドラッグハンドルを追加
  const dragHandle = document.createElement('div');
  dragHandle.classList.add('drag-handle');
  dragHandle.textContent = '⠿'; // Unicode for three horizontal dots (looks like a handle)
  songInfoContainer.appendChild(dragHandle);

  // データ属性とクラスを更新
  slotElement.classList.add('setlist-item', 'item');
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }
  slotElement.classList.toggle('short', isCurrentlyCheckedShort);
  slotElement.classList.toggle('se-active', isCurrentlyCheckedSe);
  slotElement.classList.toggle('drumsolo-active', isCurrentlyCheckedDrumsolo);

  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  slotElement.dataset.isShortVersion = hasShortOption ? 'true' : 'false';
  slotElement.dataset.hasSeOption = hasSeOption ? 'true' : 'false';
  slotElement.dataset.hasDrumsoloOption = hasDrumsoloOption ? 'true' : 'false';
  slotElement.dataset.short = isCurrentlyCheckedShort ? 'true' : 'false';
  slotElement.dataset.seChecked = isCurrentlyCheckedSe ? 'true' : 'false';
  slotElement.dataset.drumsoloChecked = isCurrentlyCheckedDrumsolo ? 'true' : 'false';
  slotElement.dataset.rGt = songData.rGt || '';
  slotElement.dataset.lGt = songData.lGt || '';
  slotElement.dataset.bass = songData.bass || '';
  slotElement.dataset.bpm = songData.bpm || '';
  slotElement.dataset.chorus = songData.chorus || '';

  // enableDragAndDrop を呼び出して、このスロットのドラッグハンドルにイベントリスナーをセットする
  // 親スロットにもdropイベントリスナーがあることを確認
  enableDragAndDrop(slotElement);

  console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and enableDragAndDrop called.`);
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  // ドラッグが開始されたのはドラッグハンドルなので、その親要素を取得
  const originalElement = event.target.closest(".setlist-item") || event.target.closest(".item");
  if (!originalElement) {
    console.warn("[dragstart:PC] Drag started on a non-draggable element or drag handle has no draggable parent.");
    event.preventDefault(); // ドラッグをキャンセル
    return;
  }

  draggingItemId = originalElement.dataset.itemId;
  event.dataTransfer.setData("text/plain", draggingItemId);
  event.dataTransfer.effectAllowed = "move";

  // 元の要素を隠す
  if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
    originalSetlistSlot = originalElement;
    originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
    originalSetlistSlot.style.visibility = 'hidden';
    originalSetlistSlot.classList.add('placeholder-slot');
    console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
  } else {
    // アルバムからのドラッグでも元を隠す
    originalElement.style.visibility = 'hidden';
    originalSetlistSlot = null; // アルバムからのドラッグなのでリセット
    console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} hidden.`);
  }

  currentPcDraggedElement = originalElement;

  if (!originalAlbumMap.has(draggingItemId)) {
    const originalList = originalElement.parentNode;
    const originalListId = originalList ? originalList.id : null;
    originalAlbumMap.set(draggingItemId, originalListId);
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
  } else {
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
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
  // `currentPcDraggedElement` または `currentTouchDraggedClone` が null でないことを確認
  const activeDraggingElement = currentPcDraggedElement || currentTouchDraggedClone;

  if (activeDraggingElement) {
    const targetSlot = event.target.closest('.setlist-slot');
    if (originalSetlistSlot && targetSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
      return;
    }
    if (targetSlot) {
      targetSlot.classList.add('drag-over');
      currentDropZone = targetSlot; // この行を追加
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
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  if (!draggingItemId) return; // draggingItemId がセットされていない場合は何もしない

  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot;

  if (newDropZone) {
    // ドラッグ中のスロットが元のスロットと同じ場合はハイライトしない
    if (originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
      if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
      }
      currentDropZone = null;
      return;
    }

    // 新しいドロップゾーンであればハイライト
    if (newDropZone !== currentDropZone) {
      if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
      }
      newDropZone.classList.add('drag-over');
      currentDropZone = newDropZone;
    }
  } else if (currentDropZone) {
    // スロット外に出たらハイライトを解除
    currentDropZone.classList.remove('drag-over');
    currentDropZone = null;
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドロップ処理
 */
function processDrop(draggedElement, dropTargetSlot, originalSourceSlot = null) {
    console.log("[processDrop] Initiated. draggedElement:", draggedElement, "dropTargetSlot:", dropTargetSlot, "originalSourceSlot:", originalSourceSlot);

    const itemId = draggedElement.dataset.itemId;
    if (!itemId) {
        console.error("[processDrop] draggedElement has no itemId. Aborting processDrop.");
        finishDragging(); // 必ずfinishDraggingを呼ぶ
        return;
    }

    let draggedItemData = null;
    // _originalItemData はセットリスト内での移動時にのみ存在する
    if (originalSourceSlot && originalSourceSlot._originalItemData && originalSourceSlot.dataset.itemId === itemId) {
        draggedItemData = originalSourceSlot._originalItemData;
        console.log("[processDrop] Using _originalItemData from originalSourceSlot:", draggedItemData);
    } else {
        // アルバムからドラッグされた場合、または_originalItemDataがない場合
        draggedItemData = getSlotItemData(draggedElement);
        // アルバムアイテムの場合、元のアルバムアイテムのオプション情報を引き継ぐ
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
        finishDragging(); // 必ずfinishDraggingを呼ぶ
        return;
    }

    const isDraggedFromSetlist = originalSourceSlot !== null;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    // ドロップターゲットがセットリストのスロット外の場合
    if (!dropTargetSlot || !setlist.contains(dropTargetSlot)) {
        console.log(`[processDrop] Dropped outside setlist. Item ID: ${itemId}`);
        if (isDraggedFromSetlist) {
            console.log(`[processDrop] Item ${itemId} was from setlist. Returning to original slot.`);
            // 元のスロットに戻す
            if (originalSourceSlot && originalSourceSlot._originalItemData) {
                fillSlotWithItem(originalSourceSlot, originalSourceSlot._originalItemData);
                originalSourceSlot.style.visibility = ''; // ここで明示的に戻す
                originalSourceSlot.classList.remove('placeholder-slot');
                delete originalSourceSlot._originalItemData;
            } else {
                // 万が一データがなくてもクリアして表示に戻す
                clearSlotContent(setlist, originalSourceSlot.dataset.slotIndex);
            }
            showMessageBox("セットリスト外にドロップされました。元の場所に戻しました。");
        } else {
            console.log(`[processDrop] Item ${itemId} was from album. Restoring to original album list.`);
            restoreToOriginalList(draggedElement);
            showMessageBox("セットリスト外にドロップされました。");
        }
        finishDragging();
        return;
    }

    // ドロップターゲットがセットリストのスロット内の場合
    const targetSlotIndex = dropTargetSlot.dataset.slotIndex;
    const existingItemInTargetSlot = dropTargetSlot.classList.contains('setlist-item') ? getSlotItemData(dropTargetSlot) : null;
    console.log(`[processDrop] Dropped into setlist slot: ${targetSlotIndex}. Existing item: ${existingItemInTargetSlot ? existingItemInTargetSlot.itemId : "none"}`);

    if (isDraggedFromSetlist) {
        // セットリスト内での並び替え
        const sourceSlotIndex = originalSourceSlot.dataset.slotIndex;
        console.log(`[processDrop] Scenario: Rearranging within setlist. From ${sourceSlotIndex} to ${targetSlotIndex}.`);

        if (sourceSlotIndex === targetSlotIndex) {
            // 同じスロットにドロップされた場合、元の位置に戻す
            console.log("[processDrop] Dropped back into original slot. Restoring visibility.");
            if (originalSourceSlot && originalSourceSlot._originalItemData) {
                fillSlotWithItem(originalSourceSlot, originalSourceSlot._originalItemData);
                originalSourceSlot.style.visibility = '';
                originalSourceSlot.classList.remove('placeholder-slot');
                delete originalSourceSlot._originalItemData;
            }
            showMessageBox("元の場所に戻しました。");
            finishDragging();
            return;
        }

        // --- 並び替えロジックをより堅牢に ---
        const tempOriginalItemData = originalSourceSlot._originalItemData; // 元のスロットのデータ

        if (existingItemInTargetSlot) {
            // ターゲットスロットに既に曲がある場合、ターゲットスロットの曲を元のスロットに移動
            console.log(`[processDrop] Swapping items. Moving ${existingItemInTargetSlot.itemId} to source slot ${sourceSlotIndex}.`);
            clearSlotContent(setlist, sourceSlotIndex); // まず元スロットをクリア
            fillSlotWithItem(originalSourceSlot, existingItemInTargetSlot);
            originalSourceSlot.style.visibility = ''; // スワップしたアイテムが見えるようにする
            originalSourceSlot.classList.remove('placeholder-slot');
        } else {
            // ターゲットスロットが空の場合、元のスロットを完全にクリア
            console.log(`[processDrop] Moving to empty slot. Clearing source slot ${sourceSlotIndex}.`);
            clearSlotContent(setlist, sourceSlotIndex);
        }
        // ドロップ先にドラッグされたアイテムを配置
        clearSlotContent(setlist, targetSlotIndex); // ドロップ先をクリア
        fillSlotWithItem(dropTargetSlot, tempOriginalItemData);
        showMessageBox("セットリストの曲を移動しました。");

    } else {
        // アルバムからセットリストへの追加
        console.log(`[processDrop] Scenario: Adding from album to slot ${targetSlotIndex}.`);

        // ドロップ先のスロットが埋まっているかチェック
        if (existingItemInTargetSlot) {
            showMessageBox('このスロットはすでに埋まっています。元のアルバムに戻します。');
            restoreToOriginalList(draggedElement); // ドラッグされたアルバムアイテムをアルバムに戻す
            finishDragging();
            return;
        }

        // セットリストの最大曲数チェック
        const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
        if (currentSongCount >= maxSongs) {
            showMessageBox('セットリストは最大曲数に達しています。元のアルバムに戻します。');
            restoreToOriginalList(draggedElement);
            finishDragging();
            return;
        }

        fillSlotWithItem(dropTargetSlot, draggedItemData);
        // アルバムからのドラッグの場合、元のアルバムアイテムは既に createTouchDraggedClone または handleDragStart で隠されているはず
        // そのため、ここではvisibilityを明示的に操作する必要はないが、restoreToOriginalListで表示に戻す
        showMessageBox("セットリストに曲を追加しました。");
    }

    finishDragging(); // ドロップ処理の最後に状態をリセット
    saveSetlistState(); // 状態保存
    updateSetlistNumbers(); // 番号更新
    hideSetlistItemsInMenu(); // メニューの表示更新
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
  event.preventDefault();
  console.log("[handleDrop] Drop event fired.");

  const droppedItemId = event.dataTransfer.getData("text/plain");
  console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

  // PCドラッグの場合、currentPcDraggedElement が元の要素
  const draggedItem = currentPcDraggedElement; // PCドラッグなのでこれで良い
  if (!draggedItem) {
    console.error("[handleDrop] PC draggedItem (currentPcDraggedElement) not found. Aborting.");
    finishDragging();
    return;
  }
  console.log("[handleDrop] draggedItem (currentPcDraggedElement) found:", draggedItem);

  const dropTargetSlot = event.target.closest('.setlist-slot');
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (outside setlist)");

  processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);

  // finishDragging は processDrop の中で呼び出されるので、ここでは不要。
  // ただし、processDropが何らかの理由で途中で抜けた場合を考慮し、最後に安全策として呼ぶことも可能だが、
  // processDrop内で確実に呼ぶようにしたため、ここでは削除
  // finishDragging();
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

    const isDragHandleTouch = event.target.closest('.drag-handle') !== null;

    if (isCheckboxClick) {
        console.log("[touchstart:Mobile] Checkbox clicked directly. Allowing native behavior.");
        lastTapTime = 0;
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        isDragging = false;
        return;
    }

    // ドラッグハンドルに触れていない場合、およびチェックボックスではない場合、スクロールを許可し、ドラッグ処理を行わない
    if (!isDragHandleTouch) {
        console.log("[touchstart:Mobile] Not drag handle or checkbox. Allowing native behavior (scroll).");
        return;
    }

    // ダブルタップ検出ロジック (ドラッグハンドルのダブルタップも考慮)
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault(); // ダブルタップの場合のみデフォルト動作をキャンセル (スクロールもブロック)
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event);
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected on drag handle. Handled by handleDoubleClick.");
        isDragging = false; // ダブルタップでドラッグは開始しない
        return;
    }
    lastTapTime = currentTime;

    // シングルタッチかつドラッグハンドルに触れた場合、ドラッグ準備を開始
    if (event.touches.length === 1 && isDragHandleTouch) {
        const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
        if (!touchedElement) {
            console.warn("[touchstart:Mobile] Drag handle touched, but no draggable item parent found. Resetting state.");
            isDragging = false;
            draggingItemId = null;
            return;
        }
        console.log("[touchstart:Mobile] Drag handle touched. Initializing potential drag for:", touchedElement.dataset.itemId);

        // ★重要: ドラッグハンドルに触れた場合は、デフォルトのスクロールを即座にブロックする
        // これにより、タッチ移動がドラッグとして認識されるようになる
        event.preventDefault();

        isDragging = false; // まだ移動がないのでドラッグは開始されていない
        draggingItemId = touchedElement.dataset.itemId;
        initialTouchX = event.touches[0].clientX;
        initialTouchY = event.touches[0].clientY;

        // originalSetlistSlot の設定は createTouchDraggedClone で行うように変更
        // ここではまだ元の要素を隠さない
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    if (event.touches.length !== 1) return;

    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;

    // draggingItemId が設定されていない場合は、ドラッグ対象ではない（touchstartでキャンセルされたか、ドラッグハンドルではなかった）
    if (!draggingItemId) {
        return;
    }

    // isDragging が false の場合、つまりまだドラッグが開始されていない場合
    if (!isDragging) {
        const deltaX = currentX - initialTouchX;
        const deltaY = currentY - initialTouchY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > DRAG_THRESHOLD) {
            // DRAG_THRESHOLD を超えたら、ドラッグを開始する
            const originalElement = document.querySelector(`.setlist-slot.setlist-item[data-item-id="${draggingItemId}"]`) || document.querySelector(`.album-content .item[data-item-id="${draggingItemId}"]`);
            if (!originalElement) {
                 console.warn("[handleTouchMove] Drag threshold met, but initial touched element not found (itemId:", draggingItemId, "). Resetting drag state.");
                 draggingItemId = null;
                 isDragging = false;
                 return;
            }

            isDragging = true; // ここで初めて isDragging を true に設定
            createTouchDraggedClone(originalElement, initialX, initialY, draggingItemId);
            console.log("[handleTouchMove] Dragging started due to movement threshold for itemId:", draggingItemId);
            event.preventDefault(); // ドラッグが開始されたらスクロールを完全にブロック
        } else {
            // しきい値に達していないが、touchstartでpreventDefault済みなので、スクロールは発生しない。
            // ドラッグハンドルを触り続けている間は、デフォルトのスクロールをブロックし続ける。
            event.preventDefault(); // これにより、ドラッグハンドルを触っている間は確実にスクロールをブロック
            return;
        }
    }

    // isDragging が true の場合のみ、クローン移動とドロップゾーンハイライトを行う
    if (isDragging && currentTouchDraggedClone) {
        event.preventDefault(); // ドラッグ中は常にデフォルトのスクロール動作をキャンセル

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

            // クローンの位置を更新
            currentTouchDraggedClone.style.left = (newX - currentTouchDraggedClone.offsetWidth / 2) + 'px';
            currentTouchDraggedClone.style.top = (newY - currentTouchDraggedClone.offsetHeight / 2) + 'px';

            // ドロップターゲットの検出とハイライト
            const targetElement = document.elementFromPoint(newX, newY);
            const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

            // 元のスロット自身をハイライトしないようにする（並び替えの場合）
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
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理
 */
function handleTouchEnd(event) {
    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    const isCheckboxClick = closestCheckbox !== null;

    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // ドラッグが開始されていなかった場合、およびチェックボックスクリックでは、finishDragging を呼ばない
    if (!isDragging) {
        if (!isCheckboxClick) {
            console.log("[touchend] Not dragging, not a checkbox click. Allowing default behaviors (e.g., scroll).");
        } else {
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        }
        return; // ドラッグしていなかったので、ここで処理を終了
    }

    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging(); // 安全のためリセット
        return;
    }

    // ドロップターゲットの決定
    // event.changedTouches[0] は、指が離れた位置の情報を得るために使用
    const touch = event.changedTouches[0];
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

    // processDrop を呼び出す
    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    // finishDragging は processDrop の中で呼び出されるので、ここでは不要。
    // ただし、processDropが何らかの理由で途中で抜けた場合を考慮し、最後に安全策として呼ぶことも可能だが、
    // processDrop内で確実に呼ぶようにしたため、ここでは削除
    // finishDragging();
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body.");
        // 問題が発生した場合、ここでドラッグ状態をリセットすることも検討
        // isDragging = false;
        // draggingItemId = null;
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // クラスコピー（すべてのアルバムクラスと状態クラスをコピー）
    Array.from(originalElement.classList).forEach(cls => {
        if (cls.startsWith('album') || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active' || cls === 'setlist-item' || cls === 'item') {
            currentTouchDraggedClone.classList.add(cls);
        }
    });

    // dataset コピー
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    // itemId は確実な値をセット
    currentTouchDraggedClone.dataset.itemId = itemIdToClone;

    document.body.appendChild(currentTouchDraggedClone);

    // 元の要素を隠す処理
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        // セットリスト内のアイテムをドラッグした場合
        originalSetlistSlot = originalElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot'); // 並び替え時のプレースホルダ
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} hidden and marked as placeholder.`);
    } else {
        // アルバムリストからのアイテムをドラッグした場合
        originalElement.style.visibility = 'hidden'; // 元のアルバムアイテムを隠す
        originalSetlistSlot = null; // アルバムからのドラッグなのでリセット
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録 (重複防止チェック)
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
    // タッチの中心にクローンの中心が来るように調整
    currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローンはイベントを拾わない

    console.log(`[createTouchDraggedClone] Clone created for itemId=${itemIdToClone}`);
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグで元の要素を隠していた場合、表示に戻す
  if (currentPcDraggedElement) {
    currentPcDraggedElement.style.visibility = ''; // 表示に戻す
    currentPcDraggedElement.classList.remove("dragging"); // もし付けていたら削除
    console.log(`[finishDragging] Restored visibility and removed 'dragging' for PC element: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }

  // モバイルドラッグクローンを削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null;

  // originalSetlistSlot がプレースホルダー状態であれば、一時的なスタイルを解除する
  if (originalSetlistSlot) {
      originalSetlistSlot.classList.remove('placeholder-slot');
      // originalSetlistSlotのvisibilityは、clearSlotContentまたはfillSlotWithItemで管理されるべき
      // ここでは、もし hideされていたら表示に戻す
      originalSetlistSlot.style.visibility = '';
      if (originalSetlistSlot._originalItemData) {
          delete originalSetlistSlot._originalItemData;
      }
      console.log(`[finishDragging] Cleaned up originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex}.`);
  }

  // 全てのスロットからドラッグオーバーなどのクラスを削除
  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target');
    slot.style.opacity = ''; // 透過度をリセット
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // グローバルなドラッグ状態変数をリセット
  currentDropZone = null;
  activeTouchSlot = null;
  currentPcDraggedElement = null; // PCドラッグ元の参照をクリア
  draggingItemId = null;
  isDragging = false;
  originalSetlistSlot = null; // セットリストからのドラッグ元参照をクリア

  // タイムアウトやアニメーションフレームのクリア
  if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
  }

  // UIの状態を更新
  hideSetlistItemsInMenu(); // セットリストにあるアイテムをメニューで非表示にする
  saveSetlistState(); // 状態を保存する関数を呼び出す
  updateSetlistNumbers(); // セットリストの番号を更新する関数を呼び出す

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
  const item = event.target.closest(".item") || event.target.closest(".setlist-slot.setlist-item");
  if (!item) {
    console.log("[handleDoubleClick] No item found for double click.");
    finishDragging(); // 何も処理せず終了する場合でもリセット
    return;
  }

  event.preventDefault();
  event.stopPropagation(); // イベントの伝播を停止
  console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

  const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

  if (isInsideSetlist) {
    console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
    restoreToOriginalList(item);
  } else {
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));

    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      finishDragging();
      return;
    }

    // すでにセットリストに同じアイテムがあるか確認
    if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
      const originalList = item.parentNode;
      // originalAlbumMap に元のリストIDを記録（既に存在しなければ）
      if (!originalAlbumMap.has(item.dataset.itemId)) {
        originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null);
        console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
      }

      item.style.visibility = 'hidden'; // アルバム内の元のアイテムを非表示にする
      console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

      const itemData = getSlotItemData(item);
      if (itemData) {
        // アルバムアイテムのdatasetから直接オプションの有無を取得し、itemDataにマージ
        itemData.hasShortOption = item.dataset.isShortVersion === 'true';
        itemData.hasSeOption = item.dataset.hasSeOption === 'true';
        itemData.hasDrumsoloOption = item.dataset.hasDrumsoloOption === 'true';

        fillSlotWithItem(emptySlot, itemData);
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
      } else {
        console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
      }
    } else {
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
    }
  }
  finishDragging(); // ダブルクリック処理の最後に必ずリセット
}
document.addEventListener("dblclick", handleDoubleClick);


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // スロット自体へのドロップイベントリスナー
    if (element.classList.contains('setlist-slot')) {
        // ドロップイベントリスナーが既に設定されていないことを確認
        if (!element._hasDropListeners) { // カスタムフラグ
            element.addEventListener("dragover", handleDragOver);
            element.addEventListener("drop", handleDrop);
            element.addEventListener("dragenter", handleDragEnter);
            element.addEventListener("dragleave", handleDragLeave);
            element._hasDropListeners = true;
            console.log(`[enableDragAndDrop] Drop listeners added to setlist-slot ${element.dataset.slotIndex}`);
        }
    }

    // ドラッグ可能なアイテム（アルバムの曲、またはセットリストの曲）の場合
    const draggableItem = element.classList.contains('item') ? element : null;

    if (draggableItem) {
        // アイテムIDがない場合は生成
        if (!draggableItem.dataset.itemId) {
            draggableItem.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!draggableItem.dataset.songName) {
            draggableItem.dataset.songName = draggableItem.textContent.trim();
        }

        // ドラッグハンドルを取得
        let dragHandle = draggableItem.querySelector('.drag-handle');
        if (!dragHandle) {
            // セットリストアイテムの場合、fillSlotWithItem でドラッグハンドルが生成されるはずだが
            // アルバムアイテムには通常最初から drag-handle はないため、ここで生成が必要か確認
            // 現状では fillSlotWithItem がセットリストアイテムにのみ drag-handle を追加しているため、
            // アルバムアイテムには drag-handle がない。
            // アルバムアイテム全体をドラッグ可能にするか、アルバムアイテムにも drag-handle を追加するか決める。
            // 今回はアルバムアイテム全体をドラッグ可能にする。
            console.warn(`[enableDragAndDrop] No drag handle found for draggableItem: ${draggableItem.dataset.itemId}. Applying draggable to the item itself.`);
            draggableItem.draggable = true; // PC向けドラッグをアイテム自体に設定

            // PC向けドラッグイベントをアイテム自体に設定
            if (!draggableItem._hasPcDragListeners) {
                draggableItem.addEventListener("dragstart", handleDragStart);
                draggableItem._hasPcDragListeners = true;
            }

            // モバイル向けタッチイベントをアイテム自体に設定 (passive: false でスクロールブロック)
            if (!draggableItem._hasMobileTouchListeners) {
                draggableItem.addEventListener("touchstart", handleTouchStart, { passive: false }); // ★重要: passive: false に変更
                draggableItem.addEventListener("touchmove", handleTouchMove, { passive: false });
                draggableItem.addEventListener("touchend", handleTouchEnd);
                draggableItem.addEventListener("touchcancel", handleTouchEnd);
                draggableItem._hasMobileTouchListeners = true;
            }

        } else {
            // dragHandle が存在する場合、そのハンドルにイベントリスナーを設定
            dragHandle.draggable = true; // ドラッグハンドルをdraggableにする

            if (!dragHandle._hasPcDragListeners) {
                dragHandle.addEventListener("dragstart", handleDragStart);
                dragHandle._hasPcDragListeners = true;
            }

            if (!dragHandle._hasMobileTouchListeners) {
                dragHandle.addEventListener("touchstart", handleTouchStart, { passive: false }); // ★重要: passive: false に変更
                dragHandle.addEventListener("touchmove", handleTouchMove, { passive: false });
                dragHandle.addEventListener("touchend", handleTouchEnd);
                dragHandle.addEventListener("touchcancel", handleTouchEnd);
                dragHandle._hasMobileTouchListeners = true;
            }
            console.log(`[enableDragAndDrop] Drag handle setup for itemId: ${draggableItem.dataset.itemId}`);
        }
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
 * @param {string} albumId - 切り替えるアルバムのID (例: "album1")
 */
function toggleAlbumContent(albumId) {
  document.querySelectorAll(".album-content").forEach(content => {
    if (content.id === albumId) {
        content.classList.toggle("active");
        console.log(`[toggleAlbumContent] Album ${albumId} is now: ${content.classList.contains('active') ? 'active' : 'inactive'}`);
    } else {
        content.classList.remove("active");
    }
  });
}


/*------------------------------------------------------------------------------------------------------------*/

// これ以降の saveSetlistState, loadSetlistState, updateSetlistNumbers,
// setupDatePickers, populateYear, generatePdf, shareSetlist,
// openModal, closeModal, openPastSetlistsModal, showPastSetlistsForYear
// といった関数は以前のコードから変更がないものと仮定します。
// そのため、上記のコードには含めませんが、実際には存在する必要があります。

// Initial setup on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    // セットリストのスロットを初期化し、enableDragAndDropを適用
    for (let i = 0; i < maxSongs; i++) {
        const slot = document.createElement("li");
        slot.classList.add("setlist-slot");
        slot.dataset.slotIndex = i;
        setlist.appendChild(slot);
        enableDragAndDrop(slot); // スロット自体にドロップイベントを登録
    }

    // アルバムリストの各アイテムに enableDragAndDrop を適用
    // ここで .item にドラッグハンドルがない場合、アイテム自体がdraggableになるように考慮
    document.querySelectorAll(".album-content .item").forEach(item => {
        enableDragAndDrop(item);
    });

    // 既存のセットリストの状態をロード
    loadSetlistState(); // この関数がどこかで定義されていることを前提とします

    // 日付ピッカーのセットアップ
    setupDatePickers(); // この関数がどこかで定義されていることを前提とします

    // イベントリスナーのセットアップ
    menuButton.addEventListener("click", toggleMenu);
    document.querySelectorAll(".album-list li[data-album-id]").forEach(tab => {
        tab.addEventListener("click", () => toggleAlbumContent(tab.dataset.albumId));
    });

    document.getElementById("shareSetlistButton").addEventListener("click", shareSetlist); // 定義されていることを前提
    document.getElementById("generatePdfButton").addEventListener("click", generatePdf); // 定義されていることを前提

    // 過去セットリストモーダルのボタン
    document.getElementById("openPastSetlistsModal").addEventListener("click", openPastSetlistsModal); // 定義されていることを前提
    document.getElementById("pastSetlistsModal").querySelector(".close-button").addEventListener("click", closeModal); // 定義されていることを前提

    // メニューが開いているかどうかに応じて、初期ロード時にアルバム内の曲の表示/非表示を調整
    hideSetlistItemsInMenu();
    updateSetlistNumbers(); // 定義されていることを前提

    // 会場入力欄の変更を監視し、状態保存
    const setlistVenueInput = document.getElementById('setlistVenue');
    if (setlistVenueInput) {
        setlistVenueInput.addEventListener('change', saveSetlistState); // 定義されていることを前提
    }
});



/**
 * ダブルクリック（ダブルタップ）時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDoubleClick(event) {
  const item = event.target.closest(".item") || event.target.closest(".setlist-slot.setlist-item");
  if (!item) {
    console.log("[handleDoubleClick] No item found for double click.");
    finishDragging();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

  const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

  if (isInsideSetlist) {
    console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
    restoreToOriginalList(item);
  } else {
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
    
    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      finishDragging();
      return;
    }

    if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
      const originalList = item.parentNode;
      originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null); 
      console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
      
      item.style.visibility = 'hidden'; 
      console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

      const itemData = getSlotItemData(item);
      // ★ドラムソロに関する追加: アルバムアイテムのオプション情報をitemDataに追加 ★
      if (itemData) {
        // アルバムアイテムのdatasetから直接オプションの有無を取得し、itemDataにマージ
        itemData.hasShortOption = item.dataset.isShortVersion === 'true';
        itemData.hasSeOption = item.dataset.hasSeOption === 'true';
        itemData.hasDrumsoloOption = item.dataset.hasDrumsoloOption === 'true'; // ★追加: ドラムソロオプションの有無
        
        fillSlotWithItem(emptySlot, itemData);
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
      } else {
        console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
      }
    } else {
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
    }
  }
  finishDragging(); 
}
document.addEventListener("dblclick", handleDoubleClick);

/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    if (element.classList.contains('item')) {
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) {
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true;

        element.addEventListener("dragstart", handleDragStart);
        
        element.addEventListener("touchstart", handleTouchStart, { passive: true });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
    } else if (element.classList.contains('setlist-slot')) {
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

        // --- ここから修正 ---
        const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
        let songListText = "";
        let itemNo = 1; // 共有テキスト用の連番カウンタ

        // album1として扱うdata-item-idのリスト
        // これはアルバム1のアイテムが特別なフォーマット（インデント）で表示されるためのロジックです。
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
                // ★ドラムソロに関する追加: 共有テキストにドラムソロの有無を追加 ★
                if (songData.drumsoloChecked) {
                    titleText += ' (ドラムソロ有り)';
                }
                // ★ここまで追加★

                // data-item-idがalbum1ItemIdsリストに含まれているかをチェック
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
        // --- ここまで修正 ---

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


document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop and date pickers.");

    // アルバムアイテムにドラッグ＆ドロップイベントを設定
    document.querySelectorAll(".album-content .item").forEach((item) => {
      enableDragAndDrop(item);
      console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId}`);
    });

    // セットリストのスロットにドロップターゲットとしてのイベントを設定
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
      if (!slot.dataset.slotIndex) {
          slot.dataset.slotIndex = index.toString();
      }
      enableDragAndDrop(slot);

      // スロット全体のクリックリスナー（チェックボックス用）
      slot.addEventListener('click', (e) => {
          const checkbox = e.target.closest('input[type="checkbox"]');
          if (checkbox) {
              console.log("[slotClick] Checkbox clicked via slot listener.");
              e.stopPropagation(); 
              
              const optionType = checkbox.dataset.optionType;

              if (optionType === 'short') {
                  slot.classList.toggle('short', checkbox.checked);
                  slot.dataset.short = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} short status changed to: ${checkbox.checked}`);
              } else if (optionType === 'se') {
                  slot.classList.toggle('se-active', checkbox.checked);
                  slot.dataset.seChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} SE status changed to: ${checkbox.checked}`);
              } else if (optionType === 'drumsolo') { // ★ドラムソロに関する追加: ドラムソロオプションの処理
                  slot.classList.toggle('drumsolo-active', checkbox.checked);
                  slot.dataset.drumsoloChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} drumsolo status changed to: ${checkbox.checked}`);
              }
              // ★ここまで追加★
              
              lastTapTime = 0; 
              if (touchTimeout) {
                  clearTimeout(touchTimeout);
                  touchTimeout = null;
              }
          }
      });

      // セットリストスロットにダブルクリックリスナーを追加
      slot.addEventListener("dblclick", handleDoubleClick); 
    });
    console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

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

    // デフォルトで今日の日付を選択状態にする
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

    loadSetlistState().then(() => {
      console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
      hideSetlistItemsInMenu();
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu();
    });
});