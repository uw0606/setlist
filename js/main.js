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
    let isCheckedSe = false;
    // --- ドラムソロに関する追加 ---
    let isCheckedDrumsolo = false; // ★追加: ドラムソロのチェック状態
    let hasDrumsoloOption = false; // ★追加: ドラムソロオプションがあるか
    // --- ここまで ---

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
        
        // ショートチェックボックスの状態
        const shortCheckbox = element.querySelector('input[type="checkbox"][data-option-type="short"]');
        isCheckedShort = shortCheckbox ? shortCheckbox.checked : false;
        // SEチェックボックスの状態
        const seCheckbox = element.querySelector('input[type="checkbox"][data-option-type="se"]');
        isCheckedSe = seCheckbox ? seCheckbox.checked : false;
        // --- ドラムソロに関する追加 ---
        const drumsoloCheckbox = element.querySelector('input[type="checkbox"][data-option-type="drumsolo"]');
        isCheckedDrumsolo = drumsoloCheckbox ? drumsoloCheckbox.checked : false;
        // --- ここまで ---

        // セットリストアイテムの場合、データ属性からオプションの有無を取得
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        // --- ドラムソロに関する追加 ---
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true'; // ★追加
        // --- ここまで ---

        rGt = element.dataset.rGt || '';
        lGt = element.dataset.lGt || '';
        bass = element.dataset.bass || '';
        bpm = element.dataset.bpm || '';
        chorus = element.dataset.chorus || '';

    } else if (isAlbumItem) {
        songName = element.dataset.songName || element.textContent.trim();
        // アルバムアイテムの場合、データ属性からオプションの有無を取得
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        // --- ドラムソロに関する追加 ---
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true'; // ★追加
        // --- ここまで ---

        isCheckedShort = false; // アルバムではチェック状態は持たない
        isCheckedSe = false;    // アルバムではチェック状態は持たない
        // --- ドラムソロに関する追加 ---
        isCheckedDrumsolo = false; // アルバムではチェック状態は持たない
        // --- ここまで ---

        // アルバムアイテムの場合、HTMLのデータ属性から直接取得される
        rGt = element.dataset.rGt || '';
        lGt = element.dataset.lGt || '';
        bass = element.dataset.bass || '';
        bpm = element.dataset.bpm || '';
        chorus = element.dataset.chorus || '';

    } else if (element.dataset.itemId) { // クローン要素などの場合
        songName = element.dataset.songName;
        // クローンは data-short と data-se-checked を持つ可能性あり
        isCheckedShort = element.dataset.short ? element.dataset.short === 'true' : false; 
        isCheckedSe = element.dataset.seChecked ? element.dataset.seChecked === 'true' : false;
        // --- ドラムソロに関する追加 ---
        isCheckedDrumsolo = element.dataset.drumsoloChecked ? element.dataset.drumsoloChecked === 'true' : false; // ★追加
        // --- ここまで ---
        
        // クローンは元の要素のオプション情報も引き継ぐ
        hasShortOption = element.dataset.isShortVersion === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        // --- ドラムソロに関する追加 ---
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true'; // ★追加
        // --- ここまで ---

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
        short: isCheckedShort,       // ショートチェックボックスの現在の状態
        seChecked: isCheckedSe,      // SEチェックボックスの現在の状態
        drumsoloChecked: isCheckedDrumsolo, // ★追加: ドラムソロチェックボックスの現在の状態**
        hasShortOption: hasShortOption, // ショートオプションの有無 (元のHTML由来)
        hasSeOption: hasSeOption,    // SEオプションの有無 (元のHTML由来)
        hasDrumsoloOption: hasDrumsoloOption, // ★追加: ドラムソロオプションの有無 (元のHTML由来)**
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
            // songInfoContainer.style.cssText = ''; // スタイルリセットはCSSで制御するため不要になる可能性あり
        }
        
        // クラスの削除に 'drumsolo-active' を追加
        slotToClear.classList.remove('setlist-item', 'item', 'short', 'se-active', 'drumsolo-active', 'placeholder-slot'); // ★変更: 'drumsolo-active' クラスも追加
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id'); 
        slotToClear.removeAttribute('data-song-name');
        slotToClear.removeAttribute('data-is-short-version'); 
        slotToClear.removeAttribute('data-has-se-option');
        // ドラムソロ関連のデータ属性の削除を追加
        slotToClear.removeAttribute('data-has-drumsolo-option'); // ★追加
        slotToClear.removeAttribute('data-short');
        slotToClear.removeAttribute('data-se-checked');
        slotToClear.removeAttribute('data-drumsolo-checked');    // ★追加
        
        slotToClear.removeAttribute('data-r-gt');
        slotToClear.removeAttribute('data-l-gt');
        slotToClear.removeAttribute('data-bass');
        slotToClear.removeAttribute('data-bpm');
        slotToClear.removeAttribute('data-chorus');

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
        const songData = getSlotItemData(slot); // 新しいデータも取得
        let line = `${index + 1}. ${songData?.name || ''}`;
        if (songData.short) {
            line += ' (Short)';
        }
        if (songData.seChecked) {
            line += ' (SE有り)';
        }
        // ★ドラムソロに関する追加★
        if (songData.drumsoloChecked) { // ドラムソロがチェックされている場合
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
 * 例: { itemId: "...", name: "曲名", albumClass: "...", short: true/false, seChecked: true/false, drumsoloChecked: true/false, hasShortOption: true/false, hasSeOption: true/false, hasDrumsoloOption: true/false, rGt: "D", lGt: "D", bass: "D", bpm: "180", chorus: "あり" }
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
  // ★ドラムソロに関する追加★
  const isCurrentlyCheckedDrumsolo = songData.drumsoloChecked; // ドラムソロチェック状態を取得
  // ★ここまで追加★

  Array.from(slotElement.classList).forEach(cls => {
    if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active') { // ★変更: 'drumsolo-active' クラスも削除対象に追加
      slotElement.classList.remove(cls);
    }
  });

  const hasShortOption = songData.hasShortOption === true;
  const hasSeOption = songData.hasSeOption === true;
  // ★ドラムソロに関する追加★
  const hasDrumsoloOption = songData.hasDrumsoloOption === true; // ドラムソロオプションの有無を取得
  // ★ここまで追加★

  // --- 曲名とオプション（Short/SE/ドラムソロ）部分 ---
  const songNameAndOptionDiv = document.createElement('div');
  songNameAndOptionDiv.classList.add('song-name-and-option'); // 新しいラッパーDiv

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

  // ★ドラムソロに関する追加★
  if (hasDrumsoloOption) {
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedDrumsolo; // ドラムソロのチェック状態を反映
    checkbox.dataset.optionType = 'drumsolo';
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(ドラムソロ有り)';
    label.classList.add('drumsolo-label'); // 新しいクラスを追加
    checkboxWrapper.appendChild(label);
    songNameAndOptionDiv.appendChild(checkboxWrapper);
  }
  // ★ここまで追加★
  
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

  // 情報があれば additionalInfoDiv に追加
  if (infoParts.length > 0) {
      additionalInfoDiv.textContent = infoParts.join(' | ');
  } else {
      // 情報がない場合は要素自体を非表示にするか、スタイルで対応
      additionalInfoDiv.style.display = 'none'; 
  }

  // songInfoContainer に二つの主要な子要素を追加
  songInfoContainer.appendChild(songNameAndOptionDiv);
  songInfoContainer.appendChild(additionalInfoDiv);

  slotElement.classList.toggle('short', isCurrentlyCheckedShort);
  slotElement.dataset.short = isCurrentlyCheckedShort ? 'true' : 'false';

  slotElement.classList.toggle('se-active', isCurrentlyCheckedSe);
  slotElement.dataset.seChecked = isCurrentlyCheckedSe ? 'true' : 'false';

  // ★ドラムソロに関する追加★
  slotElement.classList.toggle('drumsolo-active', isCurrentlyCheckedDrumsolo); // クラスのトグル
  slotElement.dataset.drumsoloChecked = isCurrentlyCheckedDrumsolo ? 'true' : 'false'; // データ属性の更新
  // ★ここまで追加★

  slotElement.classList.add('setlist-item', 'item');
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }

  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  slotElement.dataset.isShortVersion = hasShortOption ? 'true' : 'false'; 
  slotElement.dataset.hasSeOption = hasSeOption ? 'true' : 'false';
  // ★ドラムソロに関する追加★
  slotElement.dataset.hasDrumsoloOption = hasDrumsoloOption ? 'true' : 'false'; // ドラムソロオプションの有無をデータ属性に保存
  // ★ここまで追加★

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
        // セットリストからドラッグされた場合は、_originalItemData を使う
        draggedItemData = originalSetlistSlot._originalItemData;
        console.log("[processDrop] Using _originalItemData from originalSetlistSlot:", draggedItemData);
    } else {
        // アルバムからドラッグされた場合は、getSlotItemData で基本的なデータを取得
        // ここで getSlotItemData(draggedElement) がデータ属性から取得しているので、
        // originalAlbumItem からの追加取得は基本的に不要だが、念のため残すことも可能
        draggedItemData = getSlotItemData(draggedElement); 

        // ★ドラムソロに関する追加: アルバムからのドラッグの場合、元のアルバムアイテムのオプション情報を引き継ぐ ★
        const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (originalAlbumItem) {
            // draggedItemData に直接追加・上書き
            draggedItemData.isShortVersion = originalAlbumItem.dataset.isShortVersion === 'true'; // datasetは文字列なので変換
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
        // ⭐ セットリスト内での移動 ⭐
        if (dropTargetSlot) {
            const originalIndex = originalSetlistSlot ? originalSetlistSlot.dataset.slotIndex : null;
            const targetIndex = dropTargetSlot.dataset.slotIndex;

            if (dropTargetSlot.classList.contains('setlist-item')) {
                // 入れ替え (両方埋まっているスロット)
                console.log(`[processDrop] Swapping items. Original slot: ${originalIndex}, Target slot: ${targetIndex}`);
                const targetSlotItemData = getSlotItemData(dropTargetSlot); // ドロップ先の曲データを取得

                // データ更新とDOM更新
                // originalSetlistSlotの内容をtargetSlotItemDataで埋める
                if (originalSetlistSlot) { // originalSetlistSlotがnullでないことを確認
                    fillSlotWithItem(originalSetlistSlot, targetSlotItemData);
                }
                // dropTargetSlotをdraggedItemDataで埋める
                fillSlotWithItem(dropTargetSlot, draggedItemData);

            } else {
                // 空のスロットへの移動 (元のスロットは空になる)
                console.log(`[processDrop] Moving item to empty slot. Original slot: ${originalIndex}, Target slot: ${targetIndex}`);
                
                // 元のスロットをクリアする
                if (originalSetlistSlot) { // originalSetlistSlotがnullでないことを確認
                    clearSlotContent(setlist, originalIndex);
                }
                // ドロップ先の空スロットにアイテムを埋める
                fillSlotWithItem(dropTargetSlot, draggedItemData);
            }
        } else {
            // ⭐ セットリスト外へのドロップ (セットリストから) ⭐
            console.log("[processDrop] Dropped outside setlist (from setlist). Restoring to original slot.");
            // 元のスロットにアイテムを戻す
            if (originalSetlistSlot && originalItemData) { // originalSetlistSlotとデータが揃っていることを確認
                fillSlotWithItem(originalSetlistSlot, originalItemData); // 非表示になった元のスロットをデータで埋め戻し、表示に戻す
            } else {
                console.warn("[processDrop] Cannot restore original setlist slot, data missing.");
            }
        }
    } else {
        // ⭐ アルバムからのドラッグ ⭐
        if (dropTargetSlot) {
            // セットリスト内のスロットへのドロップ
            if (dropTargetSlot.classList.contains('setlist-item')) {
                // 埋まっているスロットへのドロップ
                showMessageBox('このスロットはすでに埋まっています。');
                restoreToOriginalList(draggedElement); // アルバムアイテムの場合、元のリストに戻す
                return;
            }

            // 最大曲数チェック (空スロットへの追加時のみ)
            const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
            if (currentSongCount >= maxSongs) {
                showMessageBox('セットリストは最大曲数に達しています。');
                restoreToOriginalList(draggedElement); 
                return;
            }

            // 空スロットへの追加
            console.log(`[processDrop] Adding item from album. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
            fillSlotWithItem(dropTargetSlot, draggedItemData);
            
            // アルバムの元のアイテムを非表示にする
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItem) {
                albumItem.style.visibility = 'hidden'; 
            }
        } else {
            // ⭐ セットリスト外へのドロップ (アルバムから) ⭐
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
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchStart(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    const isCheckboxClick = closestCheckbox !== null;

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

    let touchedElement = null;
    const albumItem = event.target.closest(".album-content .item");
    if (albumItem) {
        touchedElement = albumItem;
    } else {
        const setlistSlot = event.target.closest(".setlist-slot");
        if (setlistSlot && setlistSlot.classList.contains('setlist-item')) {
            touchedElement = setlistSlot;
        }
    }

    // ⭐ 最も重要な修正ポイント ⭐
    // ドラッグ対象となる要素が「存在する」かつ「data-item-id」を持っているかをここでチェックする
    // これにより、空のスロットはここで確実に弾かれる。
    // !!touchedElement.dataset.itemId は、undefined, null, '' を false と評価する
    if (!touchedElement || !touchedElement.dataset.itemId) {
        console.log("[touchstart:Mobile] Touched non-draggable/empty element (no valid item ID). Allowing default behavior (e.g., scrolling).");
        return; // ここで return することで、その後のドラッグ開始処理を全てスキップ
    }

    // 以下の処理は、touchedElement が有効な曲アイテムである場合にのみ実行される

    // ダブルタップ検出ロジック
    if (tapLength < 300 && tapLength > 0) {
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event);
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime;

    if (event.touches.length === 1) {
        console.log("[touchstart:Mobile] Touched draggable element (non-checkbox):", touchedElement);
        // この時点では touchedElement.dataset.itemId は必ず有効な文字列になっているはず
        draggingItemId = touchedElement.dataset.itemId;
        console.log("[touchstart:Mobile] Touched element itemId:", draggingItemId);


        isDragging = false; // 初期状態ではドラッグは開始されていない

        if (touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
            console.log(`[touchstart:Mobile] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex || 'N/A'}, data:`, originalSetlistSlot._originalItemData);
        } else {
            originalSetlistSlot = null;
        }

        initialTouchX = event.touches[0].clientX;
        initialTouchY = event.touches[0].clientY;
        const rect = touchedElement.getBoundingClientRect();
        touchStartX = event.touches[0].clientX - rect.left;
        touchStartY = event.touches[0].clientY - rect.top;

        if (touchTimeout) {
            clearTimeout(touchTimeout);
        }
        touchTimeout = setTimeout(() => {
            // タイマー完了時に isDragging を true に設定
            isDragging = true;
            console.log("[touchstart:Mobile] Long press detected (timeout completed). Initiating drag.");

            const elementToClone = originalSetlistSlot || touchedElement;
            // ここでの draggingItemId は有効であることが handleTouchStart の冒頭で保証されている
            createTouchDraggedClone(elementToClone, event.touches[0].clientX, event.touches[0].clientY, draggingItemId);
        }, 300);
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
    if (event.touches.length !== 1) return; // シングルタッチ以外は無視

    const touch = event.touches[0];
    const currentClientX = touch.clientX;
    const currentClientY = touch.clientY;

    // まだドラッグが開始されていない場合 (isDragging が false)
    if (!isDragging) {
        const deltaX = Math.abs(currentClientX - initialTouchX);
        const deltaY = Math.abs(currentClientY - initialTouchY);

        if (touchTimeout && (deltaX > TAP_MOVE_THRESHOLD || deltaY > TAP_MOVE_THRESHOLD)) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
            console.log("[handleTouchMove] Moved before long press threshold. Cancelling drag initiation. Allowing scroll.");
            return;
        }
        return;
    }

    // ドラッグが開始されている場合 (isDragging が true)
    event.preventDefault(); // ドラッグ中はブラウザのスクロールを抑制

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        if (!currentTouchDraggedClone) {
            rafId = null;
            return;
        }

        // クローン要素の位置を更新
        currentTouchDraggedClone.style.left = (currentClientX - touchStartX) + 'px';
        currentTouchDraggedClone.style.top = (currentClientY - touchStartY) + 'px';

        // ⭐ 修正ポイント ⭐
        // 指の下にある要素を取得し、それがドロップ可能な `setlist-slot` であるかを厳密に確認
        const targetElement = document.elementFromPoint(currentClientX, currentClientY);
        let newDropZone = null;

        // ドロップターゲットは `.setlist-slot` であることを明確にする
        if (targetElement) {
            const potentialDropZone = targetElement.closest('.setlist-slot');
            // potentialDropZone が存在し、かつそれがセットリストの一部であることを確認する
            // （例: セットリストの親要素が setlist 変数に格納されている場合）
            if (potentialDropZone && setlist.contains(potentialDropZone)) {
                newDropZone = potentialDropZone;
            }
        }

        // ドロップゾーンのハイライト制御
        if (originalSetlistSlot && newDropZone && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
            // ドラッグ元スロットに戻った場合、ハイライトを解除
            if (currentDropZone) {
                currentDropZone.classList.remove('drag-over');
            }
            currentDropZone = null; // 元のスロットはハイライトしない
        } else if (newDropZone !== currentDropZone) {
            // 新しいドロップゾーンに入った場合
            if (currentDropZone) currentDropZone.classList.remove('drag-over'); // 古いドロップゾーンのハイライトを解除
            if (newDropZone) newDropZone.classList.add('drag-over'); // 新しいドロップゾーンをハイライト
            currentDropZone = newDropZone; // currentDropZone を更新
            console.log(`[handleTouchMove] Drop zone changed to: ${newDropZone ? newDropZone.dataset.slotIndex : 'None'}`);
        }
        rafId = null;
    });
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    const isCheckboxClick = closestCheckbox !== null;

    // 長押しタイマーがまだアクティブであればクリアする（ドラッグ開始前だった場合）
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] touchTimeout cleared (drag was not initiated via long press).");
    }

    // ドラッグしていなかった場合（長押し判定前、またはスクロール判定でドラッグがキャンセルされた場合）
    if (!isDragging) {
        if (!isCheckboxClick) { 
            console.log("[touchend] Not dragging, not a checkbox click. Allowing default behaviors.");
        } else {
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        }
        return; // ドラッグしていなかったので、ここで処理を終了
    }
    
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen. Attempting to finalize drag.");
        finishDragging(); // 不正な状態でもクリーンアップは試みる
        return;
    }
    
    // ⭐⭐ ここから修正: ドロップターゲットの決定ロジックを強化 ⭐⭐
    let dropTargetSlot = currentDropZone; // まずはリアルタイムで追跡されたドロップゾーンを使用

    // もし currentDropZone が null の場合（スロットとスロットの間で指を離した場合など）、
    // 最後に指が離された座標から最も近いセットリストスロットを探す
    if (!dropTargetSlot) {
        const touch = event.changedTouches[0]; // 最後に指が離れたタッチイベントを取得
        const dropX = touch.clientX;
        const dropY = touch.clientY;

        const setlistRect = setlist.getBoundingClientRect();

        // ドロップがセットリストの表示領域内で行われたかを確認
        if (dropX >= setlistRect.left && dropX <= setlistRect.right &&
            dropY >= setlistRect.top && dropY <= setlistRect.bottom) {
            
            let closestSlot = null;
            let minDistance = Infinity;

            // すべてのセットリストスロットをループし、最も近いスロットを見つける
            setlist.querySelectorAll('.setlist-slot').forEach(slot => {
                const slotRect = slot.getBoundingClientRect();
                // スロットの中心点とドロップ点の距離を計算（ユークリッド距離）
                const slotCenterX = slotRect.left + slotRect.width / 2;
                const slotCenterY = slotRect.top + slotRect.height / 2;
                const distance = Math.sqrt(Math.pow(dropX - slotCenterX, 2) + Math.pow(dropY - slotCenterY, 2));

                if (distance < minDistance) {
                    minDistance = distance;
                    closestSlot = slot;
                }
            });
            dropTargetSlot = closestSlot; // 最も近いスロットをドロップターゲットとする
            console.log("[touchend] Fallback: Found closest slot within setlist:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "null");
        }
    }
    // ⭐⭐ 修正ここまで ⭐⭐

    console.log("[touchend] Final drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

    // processDrop 関数に現在の情報（ドラッグ中の要素と最終的なドロップターゲット）を渡す
    // originalSetlistSlot は、セットリスト内のアイテムをドラッグした場合にセットされる
    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    // ドラッグ状態のリセットとクリーンアップは最後に行う
    finishDragging(); 
}

/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチドラッグ時のクローンを作成し、元の要素を非表示にする
 * @param {HTMLElement} originalElement - ドラッグされる元の要素 (アルバムアイテムまたはセットリストスロット)
 * @param {number} clientX - タッチの現在のX座標 (クローンの初期位置計算用)
 * @param {number} clientY - タッチの現在のY座標 (クローンの初期位置計算用)
 * @param {string} itemId - ドラッグ中のアイテムのID (必須)
 */
function createTouchDraggedClone(originalElement, clientX, clientY, itemId) {
    // ⭐ 最終的な安全チェックの強化 ⭐
    // ここで originalElement が有効な DOM 要素であり、かつ itemId が有効な文字列であることを再確認
    // 空のスロットがここまで来た場合、itemId は undefined か null なのでここで弾かれる
    if (!originalElement || typeof itemId !== 'string' || itemId.trim() === '') {
        console.warn("[createTouchDraggedClone] Aborting clone creation: originalElement is invalid OR itemId is missing/invalid. Attempting to restore visibility.");
        // isDragging が意図せず true になっている可能性があるので、ここでリセット
        isDragging = false;
        // もし originalSetlistSlot が設定されていたら、その表示を戻す
        if (originalSetlistSlot) {
            originalSetlistSlot.classList.remove('placeholder-slot');
            originalSetlistSlot.style.visibility = ''; // 非表示になっていたら表示に戻す
            console.log("[createTouchDraggedClone] Restored visibility of potentially hidden originalSetlistSlot (slot index: " + (originalSetlistSlot.dataset.slotIndex || 'N/A') + ").");
        }
        // ここでクローン作成処理を完全に終了
        return null;
    }

    // ⭐ 修正箇所: ここから下は既存のcreateTouchDraggedCloneのロジックです ⭐

    // 既にクローンが存在する場合は削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add('dragging', 'touch-dragging-clone');
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = originalElement.offsetWidth + 'px'; // 元の幅を保持
    currentTouchDraggedClone.style.height = originalElement.offsetHeight + 'px'; // 元の高さを保持
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローンがイベントをブロックしないようにする

    currentTouchDraggedClone.style.left = (clientX - touchStartX) + 'px';
    currentTouchDraggedClone.style.top = (clientY - touchStartY) + 'px';

    document.body.appendChild(currentTouchDraggedClone);
    console.log(`[createTouchDraggedClone] clone created for itemId=${itemId}`);

    // セットリスト内のアイテムをドラッグしている場合、元のスロットを非表示にしてプレースホルダーにする
    // ここも originalElement が originalSetlistSlot と一致するかどうかで判断するのがより正確
    if (originalSetlistSlot && originalSetlistSlot === originalElement) { // && setlist.contains(originalElement) は不要になるはず
        originalSetlistSlot.classList.add('placeholder-slot');
        originalSetlistSlot.style.visibility = 'hidden';
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    }

    return currentTouchDraggedClone;
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
    console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop, date pickers, and modals.");

    // --- ドラッグ＆ドロップ関連の初期設定 ---
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
              e.stopPropagation(); // 親要素へのクリックイベント伝播を停止
              
              const optionType = checkbox.dataset.optionType;

              if (optionType === 'short') {
                  slot.classList.toggle('short', checkbox.checked);
                  slot.dataset.short = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} short status changed to: ${checkbox.checked}`);
              } else if (optionType === 'se') {
                  slot.classList.toggle('se-active', checkbox.checked);
                  slot.dataset.seChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} SE status changed to: ${checkbox.checked}`);
              } else if (optionType === 'drumsolo') {
                  slot.classList.toggle('drumsolo-active', checkbox.checked);
                  slot.dataset.drumsoloChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slot.dataset.slotIndex} drumsolo status changed to: ${checkbox.checked}`);
              }
              
              lastTapTime = 0; // ダブルタップ検出のためのタイマーをリセット
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
        setlistDay.innerHTML = ''; // 現在の選択肢をクリア
        const year = parseInt(setlistYear.value);
        const month = parseInt(setlistMonth.value);
        
        const daysInMonth = new Date(year, month, 0).getDate(); // その月の日数を取得

        for (let i = 1; i <= daysInMonth; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0'); // 1桁の数字を2桁にする (例: "01")
            option.textContent = i;
            setlistDay.appendChild(option);
        }
        console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}`);
    };

    // 年のドロップダウンを生成
    if (setlistYear) {
        const currentYear = new Date().getFullYear();
        // 現在の年から過去30年、未来5年まで表示
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
        
        updateDays(); // 月と年を設定した後で、日のドロップダウンを正しく生成
        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[DOMContentLoaded] Set setlist date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[DOMContentLoaded] Date select elements (year, month, day) not fully found. Skipping auto-set date.");
    }

    // --- モーダル関連の初期設定 ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal'); // 「過去セットリスト」を開くボタン
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');             // 「過去セットリスト」モーダル
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton'); // 「過去セットリスト」モーダルの閉じるボタン

    const open2025FromPastModalButton = document.getElementById('open2025FromPastModalButton'); // 「過去セットリスト」から2025年を開くボタン
    const year2025DetailModal = document.getElementById('year2025DetailModal');         // 2025年のセットリスト詳細モーダル
    const close2025DetailModalButton = document.getElementById('close2025DetailModalButton'); // 2025年モーダルの閉じるボタン


    // --- 「過去セットリスト」モーダルの開閉処理 ---
    if (openPastSetlistsModalButton && pastSetlistsModal && closePastSetlistsModalButton) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.add('active'); // activeクラスを追加して表示
            console.log("[Modal] 'Past Setlists' Modal Opened.");
        });

        closePastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.remove('active'); // activeクラスを削除して非表示
            console.log("[Modal] 'Past Setlists' Modal Closed by button.");
        });

        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) { // オーバーレイクリックで閉じる
                pastSetlistsModal.classList.remove('active');
                console.log("[Modal] 'Past Setlists' Modal Closed by overlay click.");
            }
        });
    } else {
        console.warn("[Modal Init] One or more elements for 'Past Setlists' modal not found. Check IDs: 'openPastSetlistsModal', 'pastSetlistsModal', 'closePastSetlistsModalButton'.");
    }

    // --- 2025年セットリスト詳細モーダルの開閉処理 (直接 or 「過去セットリスト」モーダルから) ---
    // ここでは、open2025ModalButton（直接開くボタン）はHTMLにないため、open2025FromPastModalButtonのみを考慮します。
    if (year2025DetailModal && close2025DetailModalButton) {
        // 「過去セットリスト」モーダル内の「2025年」ボタンからの開く処理
        if (open2025FromPastModalButton) {
            open2025FromPastModalButton.addEventListener('click', () => {
                pastSetlistsModal.classList.remove('active'); // 既存の「過去セットリスト」モーダルを閉じる
                year2025DetailModal.classList.add('active');  // 2025年詳細モーダルを開く
                console.log("[Modal] 2025 Detail Modal Opened from 'Past Setlists' modal.");
            });
        }

        // 2025年セットリスト詳細モーダルを閉じる処理 (Xボタン)
        close2025DetailModalButton.addEventListener('click', () => {
            year2025DetailModal.classList.remove('active'); // activeクラスを削除して非表示
            console.log("[Modal] 2025 Detail Modal Closed by button.");
        });

        // 2025年セットリスト詳細モーダルのオーバーレイクリックで閉じる処理
        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) {
                year2025DetailModal.classList.remove('active');
                console.log("[Modal] 2025 Detail Modal Closed by overlay click.");
            }
        });
    } else {
        console.warn("[Modal Init] One or more elements for 2025 detail modal not fully found. Check IDs: 'year2025DetailModal', 'close2025DetailModalButton', 'open2025FromPastModalButton'.");
    }

    // --- モーダル内の setlist-link のクリックハンドラ (共有IDのロードとモーダルクローズ) ---
    // この処理は、既存の `setlist-link` へのリスナーに追加・統合されます。
    document.querySelectorAll('.setlist-link').forEach(link => {
        link.addEventListener('click', (event) => {
            const shareIdMatch = link.href.match(/\?shareId=([^&]+)/);
            if (shareIdMatch) {
                // shareIdを持つリンクの場合、デフォルトの遷移を防ぐ
                event.preventDefault(); 
                const shareId = shareIdMatch[1];
                const newUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
                
                // URLを更新し、履歴に追加
                window.history.pushState({ path: newUrl }, '', newUrl);
                
                // 新しいURLに基づいてセットリスト状態をロード
                loadSetlistState().then(() => {
                    console.log(`[setlist-link click] Setlist loaded from shareId: ${shareId}`);
                    // ロードが完了したら、両方のモーダルが閉じていることを確認
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (year2025DetailModal) year2025DetailModal.classList.remove('active');
                    console.log("[Modal] All relevant modals closed after setlist load.");

                }).catch(error => {
                    console.error("[setlist-link click] Error loading setlist:", error);
                    showMessageBox('セットリストのロードに失敗しました。');
                });
            } else {
                // shareId を持たない通常のリンク（例: .htmlファイルへのリンク）は、
                // デフォルトの動作をそのまま実行させるため、ここでは何もしない
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                // 必要であれば、HTMLリンクのデフォルト動作後にモーダルを閉じる処理を追加
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