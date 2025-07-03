let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムIDを保持 (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
let touchTimeout = null; // setTimeout のIDを保持する変数。初期値をnullに統一。
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap
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
    let isCheckedSe = false; // ★追加: SE有りのチェック状態
    let hasShortOption = false; // ★変更: ショートオプションがあるか
    let hasSeOption = false;    // ★追加: SEオプションがあるか
    let albumClass = Array.from(element.classList).find(className => className.startsWith('album'));
    let itemId = element.dataset.itemId;

    if (isSetlistItem) {
        const songInfo = element.querySelector('.song-info');
        songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : element.dataset.songName;
        
        // ショートチェックボックスの状態
        const shortCheckbox = element.querySelector('input[type="checkbox"][data-option-type="short"]');
        isCheckedShort = shortCheckbox ? shortCheckbox.checked : false;
        // SEチェックボックスの状態
        const seCheckbox = element.querySelector('input[type="checkbox"][data-option-type="se"]');
        isCheckedSe = seCheckbox ? seCheckbox.checked : false;

        // セットリストアイテムの場合、データ属性からオプションの有無を取得
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true'; // ★追加
    } else if (isAlbumItem) {
        songName = element.dataset.songName || element.textContent.trim();
        // アルバムアイテムの場合、データ属性からオプションの有無を取得
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true'; // ★追加
        isCheckedShort = false; // アルバムではチェック状態は持たない
        isCheckedSe = false;    // アルバムではチェック状態は持たない
    } else if (element.dataset.itemId) { // クローン要素などの場合
        songName = element.dataset.songName;
        // クローンは data-short と data-se-checked を持つ可能性あり
        isCheckedShort = element.dataset.short ? element.dataset.short === 'true' : false; 
        isCheckedSe = element.dataset.seChecked ? element.dataset.seChecked === 'true' : false; // ★追加
        
        // クローンは元の要素のオプション情報も引き継ぐ
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true'; // ★追加
    } else {
        console.warn("[getSlotItemData] Element has no recognizable data for item:", element);
        return null;
    }

    return {
        name: songName,
        short: isCheckedShort,       // ★変更: ショートチェックボックスの現在の状態
        seChecked: isCheckedSe,      // ★追加: SEチェックボックスの現在の状態
        hasShortOption: hasShortOption, // ★変更: ショートオプションの有無 (元のHTML由来)
        hasSeOption: hasSeOption,    // ★追加: SEオプションの有無 (元のHTML由来)
        albumClass: albumClass,
        itemId: itemId,
        slotIndex: element.dataset.slotIndex
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
            songInfoContainer.style.cssText = ''; 
        }
        
        slotToClear.classList.remove('setlist-item', 'item', 'short', 'se-active', 'placeholder-slot'); // ★変更: 'se-active' クラスも追加
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id'); 
        slotToClear.removeAttribute('data-song-name');
        slotToClear.removeAttribute('data-is-short-version'); 
        slotToClear.removeAttribute('data-has-se-option'); // ★追加
        slotToClear.removeAttribute('data-short');
        slotToClear.removeAttribute('data-se-checked');    // ★追加

        slotToClear.style.cssText = '';
        slotToClear.style.visibility = '';

        slotToClear.removeEventListener("dragstart", handleDragStart);
        slotToClear.removeEventListener("touchstart", handleTouchStart);
        slotToClear.removeEventListener("touchmove", handleTouchMove);
        slotToClear.removeEventListener("touchend", handleTouchEnd);
        slotToClear.removeEventListener("touchcancel", handleTouchEnd);
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

    // ここで直接 clearSlotContent を呼ぶのではなく、呼び出し元 (handleDrop, handleDoubleClick) で
    // 必要に応じてクリア処理を完結させるか、clearSlotContent が既に実行されているかチェックする
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
        const songInfo = slot.querySelector('.song-info');
        const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : slot.dataset.songName;
        const checkbox = slot.querySelector('input[type="checkbox"]');
        return checkbox && checkbox.checked ? `${index + 1}. ${songName} (Short)` : `${index + 1}. ${songName}`;
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

  // --- 日付の情報を年・月・日のドロップダウンから取得するよう修正 ---
  const setlistYear = document.getElementById('setlistYear');
  const setlistMonth = document.getElementById('setlistMonth');
  const setlistDay = document.getElementById('setlistDay');

  let selectedDate = '';
  // 各ドロップダウンが存在するか確認してから値を取得
  if (setlistYear && setlistMonth && setlistDay) {
    selectedDate = `${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`;
  } else {
    // 要素が見つからない場合の警告 (開発中に役立ちます)
    console.warn("[getCurrentState] Date select elements (year, month, day) not found. Date will be empty for saving.");
  }
  // --- 修正ここまで ---

  const setlistVenue = document.getElementById('setlistVenue').value;

  console.log("[getCurrentState] Setlist state for saving:", setlistState);
  console.log("[getCurrentState] Original album map for saving:", originalAlbumMapAsObject);
  console.log("[getCurrentState] Date for saving:", selectedDate); // ★修正: selectedDate を使用
  console.log("[getCurrentState] Venue for saving:", setlistVenue);

  return {
    setlist: setlistState,
    menuOpen: menuOpen,
    openAlbums: openAlbums,
    originalAlbumMap: originalAlbumMapAsObject,
    setlistDate: selectedDate, // ★修正: selectedDate を使用
    setlistVenue: setlistVenue
  };
}


/*------------------------------------------------------------------------------------------------------------*/


// --- ドラッグ&ドロップ、タッチイベントハンドラ ---

/**
 * セットリストのスロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 * 例: { itemId: "...", name: "曲名", albumClass: "...", short: true/false, seChecked: true/false, hasShortOption: true/false, hasSeOption: true/false }
 */
function fillSlotWithItem(slotElement, songData) {
  console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
  console.log(`[fillSlotWithItem]   songData received:`, songData);

  const existingSongInfoContainer = slotElement.querySelector('.song-info-container');
  let songInfoContainer;
  if (existingSongInfoContainer) {
      songInfoContainer = existingSongInfoContainer;
      songInfoContainer.innerHTML = '';
  } else {
      songInfoContainer = document.createElement('div');
      songInfoContainer.classList.add('song-info-container');
      slotElement.appendChild(songInfoContainer);
  }
  
  const itemId = songData.itemId;
  const songName = songData.name;
  const albumClass = songData.albumClass;
  const isCurrentlyCheckedShort = songData.short;    // ★変更
  const isCurrentlyCheckedSe = songData.seChecked;   // ★追加

  Array.from(slotElement.classList).forEach(cls => {
    // ★変更: 'se-active' クラスも削除対象に追加
    if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active') {
      slotElement.classList.remove(cls);
    }
  });

  // ★変更: ショートオプションとSEオプションの有無を songData から取得
  const hasShortOption = songData.hasShortOption === true;
  const hasSeOption = songData.hasSeOption === true;

  const songInfoDiv = document.createElement('div');
  songInfoDiv.classList.add('song-info');

  const songNameTextNode = document.createTextNode(songName);
  songInfoDiv.appendChild(songNameTextNode);

  // ショートバージョンチェックボックスの生成
  if (hasShortOption) {
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedShort;
    checkbox.dataset.optionType = 'short'; // ★追加: チェックボックスのタイプを識別
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(Short)';
    label.classList.add('short-label');
    checkboxWrapper.appendChild(label);
    songInfoDiv.appendChild(checkboxWrapper);
  }

  // SE有りチェックボックスの生成
  if (hasSeOption) { // ★追加ブロック
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedSe;
    checkbox.dataset.optionType = 'se'; // ★追加: チェックボックスのタイプを識別
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(SE有り)';
    label.classList.add('se-label'); // ★追加: SE用ラベルクラス
    checkboxWrapper.appendChild(label);
    songInfoDiv.appendChild(checkboxWrapper);
  }

  // ★変更: スロットのクラスとデータ属性の更新ロジックを修正
  slotElement.classList.toggle('short', isCurrentlyCheckedShort); // ショートチェック状態に応じてクラスを付与
  slotElement.dataset.short = isCurrentlyCheckedShort ? 'true' : 'false';

  slotElement.classList.toggle('se-active', isCurrentlyCheckedSe); // SEチェック状態に応じてクラスを付与
  slotElement.dataset.seChecked = isCurrentlyCheckedSe ? 'true' : 'false';

  songInfoContainer.appendChild(songInfoDiv);

  slotElement.classList.add('setlist-item', 'item');
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }

  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  // ★変更: オプションの有無をデータ属性として保存
  slotElement.dataset.isShortVersion = hasShortOption ? 'true' : 'false'; 
  slotElement.dataset.hasSeOption = hasSeOption ? 'true' : 'false'; // ★追加

  // イベントリスナーの初期化と再登録は変更なし
  slotElement.removeEventListener("dragstart", handleDragStart);
  slotElement.removeEventListener("touchstart", handleTouchStart);
  slotElement.removeEventListener("touchmove", handleTouchMove);
  slotElement.removeEventListener("touchend", handleTouchEnd);
  slotElement.removeEventListener("touchcancel", handleTouchEnd);
  
  slotElement.draggable = true;
  slotElement.addEventListener("dragstart", handleDragStart);
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
  if (setlist.contains(originalElement)) {
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

  if (!draggingItemId) return;

  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot;

  if (newDropZone) {
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
    currentDropZone.classList.remove('drag-over');
    currentDropZone = null;
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドロップ処理
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
        console.log("[processDrop] Using data from draggedElement:", draggedItemData);
    }

    if (!draggedItemData) {
        console.error("[processDrop] Failed to get item data. Aborting processDrop.");
        return;
    }

    const isDraggedFromSetlist = originalSetlistSlot !== null;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    if (isDraggedFromSetlist) {
        if (dropTargetSlot) {
            if (dropTargetSlot.classList.contains('setlist-item')) {
                console.log(`[processDrop] Swapping items. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                const targetSlotItemData = getSlotItemData(dropTargetSlot);
                if (targetSlotItemData && originalSetlistSlot) {
                    clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
                    fillSlotWithItem(originalSetlistSlot, targetSlotItemData);
                }
                clearSlotContent(setlist, dropTargetSlot.dataset.slotIndex);
                fillSlotWithItem(dropTargetSlot, draggedItemData);
            } else {
                console.log(`[processDrop] Moving item to empty slot. Original slot: ${originalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
                fillSlotWithItem(dropTargetSlot, draggedItemData);
            }
        } else {
            console.log("[processDrop] Dropped outside setlist (from setlist). Doing nothing; will restore visually.");
        }
    } else {
        if (dropTargetSlot) {
            if (dropTargetSlot.classList.contains('setlist-item')) {
                showMessageBox('このスロットはすでに埋まっています。');
                restoreToOriginalList(draggedElement); 
                return;
            }

            const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
            if (currentSongCount >= maxSongs) {
                showMessageBox('セットリストは最大曲数に達しています。');
                restoreToOriginalList(draggedElement); 
                return;
            }

            console.log(`[processDrop] Adding item from album. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
            fillSlotWithItem(dropTargetSlot, draggedItemData);
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItem) {
                albumItem.style.visibility = 'hidden'; 
            }
        } else {
            console.log("[processDrop] Dropped album item outside setlist. Restoring to original list.");
            restoreToOriginalList(draggedElement); 
        }
    }
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
  
  let draggedItem;
  if (originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId) {
      draggedItem = originalSetlistSlot;
      console.log("[handleDrop] Using originalSetlistSlot as draggedItem.");
  } else {
      draggedItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
      console.log("[handleDrop] Searched for draggedItem in album content by ID.");
  }

  if (!draggedItem) {
    console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". This can happen if the element was moved or removed unexpectedly before drop.");
    finishDragging();
    return;
  }
  console.log("[handleDrop] draggedItem found:", draggedItem);

  const dropTargetSlot = event.target.closest('.setlist-slot');
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

  if (dropTargetSlot) {
    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
  } else {
    console.warn("[handleDrop] Dropped outside a setlist slot. Attempting to restore to original list or remove.");
    if (originalSetlistSlot) {
        clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
        restoreToOriginalList(draggedItem);
    } else {
        restoreToOriginalList(draggedItem);
    }
  }
  finishDragging();
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

    // チェックボックス以外の要素がタッチされた場合のダブルタップ検出
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault(); // ダブルタップの場合のみデフォルト動作をキャンセル
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event);
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime; // 次のタップ判定のために時間を更新

    if (event.touches.length === 1) {
        const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
        if (!touchedElement) {
            console.warn("[touchstart:Mobile] No draggable item found on touch start.");
            return;
        }
        console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedElement);
        console.log("[touchstart:Mobile] Touched element itemId:", touchedElement.dataset.itemId);

        // ここでは event.preventDefault() は呼び出しません。
        // ドラッグはPCからのdragstartイベントか、今後の別のタッチジェスチャーに限定されます。

        isDragging = false; // タッチ開始時点ではドラッグ中ではないと明確に設定
        draggingItemId = touchedElement.dataset.itemId;
        
        // originalSetlistSlot の設定は維持（セットリスト内でのドラッグ＆ドロップのため）
        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
        } else {
            originalSetlistSlot = null;
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        // ★★★ ここから再導入する箇所 ★★★
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        touchTimeout = setTimeout(() => {
            // タップまたはダブルタップではないことを確認
            if (!isDragging && draggingItemId && document.body.contains(touchedElement)) {
                // ドラッグ開始が確定したため、ここで preventDefault() を呼び出す。
                // これにより、スクロールなどのデフォルト動作を抑制し、ドラッグを優先させる。
                event.preventDefault();
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true;
                // 元の要素を非表示にするのは createTouchDraggedClone 内で行うため、ここでは不要。
                // console.log("[touchstart:Mobile] Mobile drag initiated by timeout.");
            } else {
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout.");
            }
            touchTimeout = null;
        }, 600); // 例: 150ミリ秒のロングプレスでドラッグ開始
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    if (!isDragging || !currentTouchDraggedClone) return;

    event.preventDefault();

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
    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    const isCheckboxClick = closestCheckbox !== null;

    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    if (!isDragging) { // ドラッグしていなかった場合
        // チェックボックスのクリック以外は、デフォルト動作を許可するために何もしない
        if (!isCheckboxClick) { 
            console.log("[touchend] Not dragging, not a checkbox click. Allowing default behaviors.");
        } else { // チェックボックスのクリックだった場合
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        }
        return; // ドラッグしていなかったので、ここで処理を終了
    }

    // isDragging が true の場合のみ、ここから下のドラッグ終了処理を実行
    // ★★★ ここにあった event.preventDefault() は削除済みであることを確認 ★★★
    
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging(); // 問題がある場合でも状態をリセット
        return;
    }

    document.querySelectorAll('.setlist-slot.drag-over')
        .forEach(slot => slot.classList.remove('drag-over'));
    
    const touch = event.changedTouches[0];
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    finishDragging(); // ドラッグ操作が完了したため、状態をリセット
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
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // クラスコピー
    if (originalElement.classList.contains('short')) {
        currentTouchDraggedClone.classList.add('short');
    }
    if (originalElement.classList.contains('se-active')) {
        currentTouchDraggedClone.classList.add('se-active');
    }

    // dataset コピー
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone;

    // 特定データ属性も手動で確実にコピー
    if (originalElement.dataset.isShortVersion) {
        currentTouchDraggedClone.dataset.isShortVersion = originalElement.dataset.isShortVersion;
    }
    if (originalElement.dataset.hasSeOption) {
        currentTouchDraggedClone.dataset.hasSeOption = originalElement.dataset.hasSeOption;
    }

    document.body.appendChild(currentTouchDraggedClone);

    // ✅ セットリスト内のアイテムだった場合
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;  // ← 重要：スワップのためにここでセット
        const originalItemData = getSlotItemData(originalElement);
        if (originalItemData) {
            originalSetlistSlot._originalItemData = originalItemData;
            console.log(`[createTouchDraggedClone] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex}`, originalItemData);
        }
        originalSetlistSlot.classList.add('placeholder-slot');
        originalElement.style.visibility = 'hidden';
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else {
        // アルバムリストからのアイテム
        originalElement.style.visibility = 'hidden';
        originalSetlistSlot = null;
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録
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
    currentTouchDraggedClone.style.pointerEvents = 'none';

    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  if (currentPcDraggedElement && setlist.contains(currentPcDraggedElement)) {
    currentPcDraggedElement.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class for PC setlist item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }

  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null;

  // originalSetlistSlot がプレースホルダー状態であれば、一時的なスタイルを解除する
  if (originalSetlistSlot && originalSetlistSlot.classList.contains('placeholder-slot')) {
      originalSetlistSlot.classList.remove('placeholder-slot');
      // ✅ 修正: setlist-item クラスが残っている場合のみ visibility を戻す
      if (originalSetlistSlot.classList.contains('setlist-item')) {
          originalSetlistSlot.style.visibility = '';
          console.log(`[finishDragging] Restored visibility for originalSetlistSlot (still has item): ${originalSetlistSlot.dataset.slotIndex}.`);
      } else {
          // アイテムが既にクリアされている（移動または削除の場合）
          originalSetlistSlot.style.visibility = ''; // clearSlotContentで既に設定済みだが念のため
          console.log(`[finishDragging] OriginalSetlistSlot ${originalSetlistSlot.dataset.slotIndex} was cleared, ensuring visibility is normal.`);
      }
      if (originalSetlistSlot._originalItemData) {
          delete originalSetlistSlot._originalItemData;
      }
  }

  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target'); 
    slot.style.opacity = '';
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  currentDropZone = null;
  activeTouchSlot = null;
  currentPcDraggedElement = null;
  draggingItemId = null; 
  isDragging = false;
  originalSetlistSlot = null;

  if (touchTimeout) { 
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) { 
      cancelAnimationFrame(rafId);
      rafId = null;
  }

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
      if (itemData) {
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
        
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
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

        const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
        let songListText = "";
        if (setlistItems.length > 0) {
            songListText = Array.from(setlistItems).map((slot, index) => {
                const songData = getSlotItemData(slot);
                let line = ` ${index + 1}. ${songData?.name || ''}`;
                if (songData.short) {
                    line += ' (Short)';
                }
                if (songData.seChecked) {
                    line += ' (SE有り)';
                }
                return line;
            }).join("\n");
        }

        // ★変更: 共有テキストに日付と会場を追加
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
                // title: '仮セトリ',
                text: shareText, // ★変更: shareText を使用
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

            // クリア処理は変更なし
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

            // ★追加: 日付と会場の情報をロードして入力フィールドに設定
            document.getElementById('setlistDate').value = state.setlistDate || '';
            document.getElementById('setlistVenue').value = state.setlistVenue || '';
            console.log(`[loadSetlistState] Restored date: ${state.setlistDate || 'N/A'}, venue: ${state.setlistVenue || 'N/A'}`);

            // セットリストのアイテムを埋める処理は変更なし
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

            // メニューの状態復元は変更なし
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
      resolve();
    }
  });
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * 文字共有機能 (スロット対応版)
 */
function shareTextSetlist() {
  const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
  if (setlistItems.length === 0) {
    showMessageBox("セットリストに曲がありません！");
    console.log("[shareTextSetlist] Setlist is empty.");
    return;
  }

  // --- 日付の情報を年・月・日のドロップダウンから取得するよう修正 ---
  const setlistYear = document.getElementById('setlistYear');
  const setlistMonth = document.getElementById('setlistMonth');
  const setlistDay = document.getElementById('setlistDay');

  let selectedDate = '';
  // 各ドロップダウンが存在するか確認してから値を取得
  if (setlistYear && setlistMonth && setlistDay) {
    selectedDate = `${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`;
  } else {
    // 要素が見つからない場合の警告 (開発中に役立ちます)
    console.warn("[shareTextSetlist] Date select elements (year, month, day) not found. Date will be empty for sharing.");
  }
  // --- 修正ここまで ---

  const setlistVenue = document.getElementById('setlistVenue').value;

  const songListText = Array.from(setlistItems).map((slot, index) => {
    const songData = getSlotItemData(slot);
    let line = ` ${index + 1}. ${songData?.name || ''}`;
    if (songData.short) {
        line += ' (Short)';
    }
    if (songData.seChecked) {
        line += ' (SE有り)';
    }
    return line;
  }).join("\n");

  // ★変更: 共有テキストに日付と会場を追加
  let fullTextToShare = '\n';
  if (selectedDate) { // ★修正: selectedDate を使用
      fullTextToShare += `日付: ${selectedDate}\n`; // ★修正: selectedDate を使用
  }
  if (setlistVenue) {
      fullTextToShare += `会場: ${setlistVenue}\n`;
  }
  if (songListText) {
      fullTextToShare += `\n${songListText}`;
  }

  console.log("[shareTextSetlist] Generated song list for text share:\n", fullTextToShare);

  if (navigator.share) {
    navigator.share({
      // title: "仮セトリ (テキスト)", // タイトルはここでは不要な場合が多い
      text: fullTextToShare
    })
    .then(() => {
        console.log('[shareTextSetlist] Web Share API (Text) Success');
        showMessageBox('セットリストのテキストを共有しました！');
    })
    .catch(error => {
        console.error('[shareTextSetlist] Web Share API (Text) Failed:', error);
        if (error.name !== 'AbortError') { // ユーザーがキャンセルした場合はエラーメッセージを出さない
            showMessageBox('テキスト共有に失敗しました。');
        }
    });
  } else {
    // Web Share APIが利用できない場合のフォールバック（クリップボードにコピー）
    const tempInput = document.createElement('textarea');
    tempInput.value = fullTextToShare;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showMessageBox("セットリストのテキストをクリップボードにコピーしました！");
    console.log("[shareTextSetlist] Copied to clipboard (Web Share API not available).");
  }
}


/*------------------------------------------------------------------------------------------------------------*/


document.addEventListener('DOMContentLoaded', () => {
    // 他の既存の初期化コード（ドラッグ＆ドロップなど）はここに残ります
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
              }
              
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
    // この関数は、年または月が変更されたときに呼び出されます
    const updateDays = () => {
        if (!setlistYear || !setlistMonth || !setlistDay) {
            console.warn("[updateDays] Date select elements not found. Cannot update days.");
            return;
        }
        setlistDay.innerHTML = ''; // 現在のオプションをすべてクリア
        const year = parseInt(setlistYear.value);
        const month = parseInt(setlistMonth.value);
        
        // Date(year, month, 0) は、指定された月の最終日を返すJavaScriptのトリックです
        const daysInMonth = new Date(year, month, 0).getDate(); 

        for (let i = 1; i <= daysInMonth; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0'); // 例: "01", "02"
            option.textContent = i;
            setlistDay.appendChild(option);
        }
        console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}`);
    };

    // 年のドロップダウンを生成
    if (setlistYear) {
        const currentYear = new Date().getFullYear();
        // 例えば、過去30年と未来5年まで選択可能にする
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
            option.value = i.toString().padStart(2, '0'); // "01", "02" のように2桁表示
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
        // 月を設定する前に updateDays を呼び出すと、選択肢がまだないため問題が起きる可能性があります。
        // まず月を設定し、その後 updateDays を呼び出して日を生成し、最後に日を設定します。
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        
        // 月を設定した後、日のオプションを更新
        updateDays(); 

        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[DOMContentLoaded] Set setlist date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[DOMContentLoaded] Date select elements (year, month, day) not fully found. Skipping auto-set date.");
    }

    // --- ここまで日付ドロップダウンの初期化と設定 ---


    loadSetlistState().then(() => {
      console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
      hideSetlistItemsInMenu();
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu();
    });
});