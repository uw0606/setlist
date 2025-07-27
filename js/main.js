let startTouchPos = { x: 0, y: 0 }; // タッチ開始位置
let touchStartTime = 0; // タッチ開始時刻を記録
let lastTapTime = 0; // ダブルタップ判定用
let rafId = null; // requestAnimationFrame のIDを保持する変数
let lastTapTarget = null; // ダブルタップ判定用：最後にタップされた要素を記録

// グローバル変数（必要に応じて既存のものを調整）
let draggingItemId = null;
let originalSetlistSlot = null;
let currentPcDraggedElement = null; // モバイルでもPCドラッグアイテムの参照を保持
let currentTouchDraggedClone = null; // モバイルドラッグ用のクローン要素
let currentDropZone = null;
let activeTouchSlot = null;
const originalAlbumMap = new Map(); // ドラッグ開始時のアルバムリストIDを保持 (PCドラッグと共通)

// touchStartX, touchStartY は startTouchPos で代用するため削除

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26;


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


// main.js の clearSlotContent 関数

/**
 * 指定されたセットリストスロットの内容をクリアする。
 * @param {number} slotIndex - クリアするスロットのインデックス。
 * @returns {boolean} 成功した場合true、失敗した場合false。
 */
function clearSlotContent(slotIndex) {
    const slot = document.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (slot) {
        // ★ここを修正★
        // スロットからアイテム固有のクラスとデータを削除するが、
        // スロット自体のドラッグターゲットとしての機能に影響を与えるクラスは残す。
        // albumX クラス、setlist-item、item クラス、short/se-active/drumsolo-active クラスを削除
        Array.from(slot.classList).forEach(cls => {
            if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active') {
                slot.classList.remove(cls);
            }
        });

        // data-* 属性から、アイテム固有のものを削除
        for (const key in slot.dataset) {
            // slotIndex は残し、それ以外のitemId, songName, rGt, lGt, bass, bpm, chorus,
            // short, seChecked, drumsoloChecked, isShortVersion, hasSeOption, hasDrumsoloOption を削除
            if (key !== 'slotIndex') {
                delete slot.dataset[key];
            }
        }

        // 内部のHTMLを初期状態に戻す
        slot.innerHTML = `<div class="index">${slotIndex + 1}</div><div class="song-name-and-option"></div><div class="additional-song-info"></div>`;

        // ドラッグイベントリスナーを再登録 (既存のものであれば一度削除してから追加)
        // これはDOMContentLoadedで一括登録されているはずなので、ここでは不要な場合が多いですが、
        // もし動的にスロットを追加・削除するなら必要になります。今回は既存のまま。
        // slot.removeEventListener("dragstart", handleDragStart); // アイテムではないので不要
        // slot.removeEventListener("touchstart", handleTouchStart); // アイテムではないので不要
        // slot.removeEventListener("touchmove", handleTouchMove);
        // slot.removeEventListener("touchend", handleTouchEnd);
        // slot.removeEventListener("touchcancel", handleTouchEnd);
        // slot.removeEventListener("dblclick", handleDoubleClick); // ダブルクリックで削除したばかりなので不要

        // ドロップターゲットとしてのイベントは残す
        // slot.addEventListener("dragover", handleDragOver);
        // slot.addEventListener("drop", handleDrop);
        // slot.addEventListener("dragenter", handleDragEnter);
        // slot.addEventListener("dragleave", handleDragLeave);

        console.log(`[clearSlotContent] Slot ${slotIndex} content cleared and reset to empty state.`);
        return true;
    }
    console.log(`[clearSlotContent] Failed to clear slot ${slotIndex}. Slot not found.`);
    return false;
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
        // 修正点: clearSlotContent の呼び出しから `setlist` 引数を削除
        clearSlotContent(parseInt(slotToClearInSetlist.dataset.slotIndex));
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

  // イベントリスナーの重複登録を防ぐため、一度削除してから再追加
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


// main.js の handleDragOver 関数
/**
 * ドラッグオーバー時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
  // ★ここを修正★ event.preventDefault() をブロックの先頭に移動
  event.preventDefault(); // これを一番最初に呼ぶ

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  // ★event.target を直接使用するように変更 (targetElement は handleTouchMove からは event.target になる) ★
  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot;

  if (newDropZone) {
    // オリジナルスロットに戻るケースの判定を維持
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
    processDrop(droppedItemId, dropTargetSlot); // 修正点: droppedItemId を明示的に渡す
  } else {
    console.warn("[handleDrop] Dropped outside a setlist slot. Attempting to restore to original list or remove.");
    if (originalSetlistSlot) {
        // 修正点: clearSlotContent の呼び出しから `setlist` 引数を削除
        clearSlotContent(parseInt(originalSetlistSlot.dataset.slotIndex));
        restoreToOriginalList(draggedItem);
    } else {
        restoreToOriginalList(draggedItem);
    }
  }
  finishDragging();
}

// 仮の getAlbumItemData 関数 (あなたのデータ構造に合わせて修正してください)
// 例: albumData.js などで定義されている場合もあります
function getAlbumItemData(itemId) {
    // ここにアルバムデータを検索する実際のロジックを実装してください。
    // 例: return ALBUM_DATA.find(item => item.id === itemId);
    // 現在はダミーデータを返します。
    const dummyData = {
        'album2-001': { name: 'CHANCE!', short: false, seChecked: false, drumsoloChecked: false, hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false, rGt: 'Drop D', lGt: 'Drop D', bass: 'Drop D', bpm: 128, chorus: true },
        'album2-002': { name: 'トキノナミダ', short: false, seChecked: false, drumsoloChecked: false, hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false, rGt: 'Drop B', lGt: 'Drop B', bass: '5 REG', bpm: 198, chorus: true },
        // 他のアイテムデータもここに追加するか、実際のデータソースから取得してください
    };
    return dummyData[itemId] || null;
}

// main.js の touchstart 関数 (抜粋)

let touchTimeout;
let isDragging = false; // グローバル変数
// initialTouchX, initialTouchY は startTouchPos で代用するため削除
const DRAG_THRESHOLD = 10; // ドラッグ開始とみなす移動のしきい値（ピクセル）
const LONG_PRESS_DELAY = 300; // 長押しとみなす時間（ミリ秒）

function handleTouchStart(e) {
    // 既にドラッグ中の場合は何もしない
    if (isDragging) return;

    // 現在のターゲットがチェックボックスの場合は、通常の動作を許可する
    if (e.target.type === 'checkbox') {
        console.log("[touchstart] Touched a checkbox. Allowing default behavior.");
        return;
    }

    // `closest('.item')` で一番近いアイテム要素を取得
    const touchedItem = e.target.closest('.item, .setlist-slot'); // .setlist-slot も含める
    if (!touchedItem) {
        console.log("[touchstart] Touched element is not an item or setlist slot.");
        return;
    }

    const itemId = touchedItem.dataset.itemId;
    console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedItem, "itemId:", itemId);

    // ダブルタップの検出（既存のロジック）
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 500 && tapLength > 0 && touchedItem === lastTapTarget) { // 適切なダブルタップ時間と要素の確認
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        handleDoubleClick(e);
        lastTapTime = 0; // リセット
        lastTapTarget = null; // リセット
        return;
    }
    lastTapTime = currentTime;
    lastTapTarget = touchedItem;

    // 長押しによるドラッグ開始の準備
    startTouchPos.x = e.touches[0].clientX; // 修正点: initialTouchX の代わりに startTouchPos.x を使用
    startTouchPos.y = e.touches[0].clientY; // 修正点: initialTouchY の代わりに startTouchPos.y を使用

    // 長押しタイマーを設定
    touchTimeout = setTimeout(() => {
        console.log("[touchstart:Mobile] Long press detected. Initiating drag for itemId:", itemId);

        // ドラッグを開始する要素がセットリストのアイテムだった場合、originalSetlistSlotを設定
        if (touchedItem.classList.contains('setlist-slot')) {
            originalSetlistSlot = touchedItem;
            console.log("[touchstart:Mobile] Dragging from setlist slot:", itemId);
        } else {
            console.log("[touchstart:Mobile] Dragging from album list:", itemId);
            originalSetlistSlot = null; // アルバムリストからのドラッグの場合、元のスロットはなし
        }

        // ドラッグ要素のクローンを作成し、視覚的なフィードバックを提供
        // 修正点: createTouchDraggedClone に itemId を渡す
        createTouchDraggedClone(touchedItem, e.touches[0].clientX, e.touches[0].clientY, itemId);

        // touchmoveイベントでスクロールを抑制するためにisDraggingをtrueにする
        isDragging = true;

        draggingItemId = itemId; // グローバル変数にアイテムIDを保存
    }, LONG_PRESS_DELAY);
}




// main.js の handleTouchMove 関数
function handleTouchMove(e) {
    if (touchTimeout) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = Math.abs(currentX - startTouchPos.x);
        const deltaY = Math.abs(currentY - startTouchPos.y);

        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
            console.log("[touchmove] Moved beyond threshold before long press. Cancelling drag timeout. Allowing scroll.");
            return;
        }
    }

    if (isDragging) {
        e.preventDefault(); // これがスクロールを抑制する主な役割
        updateTouchDraggedClonePosition(e);

        // ドロップゾーンの判定ロジック
        const targetElement = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        
        // ★ここから修正★
        // handleDragOver に渡すためのダミーイベントオブジェクトを作成
        // touchmoveからの呼び出しであることを示すフラグとターゲット要素を含める
        const dummyEvent = {
            preventDefault: () => {}, // ダミーのpreventDefault関数
            dataTransfer: { dropEffect: 'move' }, // 必要に応じてダミーのdataTransfer
            target: targetElement // ドロップターゲットとして扱う要素
        };
        handleDragOver(dummyEvent); // ダミーイベントを渡す
        // ★ここまで修正★
    }
}





/**
 * タッチ終了時の処理 (モバイル用)
 */
function handleTouchEnd(e) {
    console.log("[touchend] Touch end detected.");

    // 長押しタイマーがまだ残っていればクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] Cleared touchTimeout.");
    }

    // ドラッグ中でなければ、処理を終了
    if (!isDragging) {
        console.log("[touchend] Not in dragging state. Allowing default behaviors for non-drag.");
        return;
    }

    e.preventDefault(); // ドラッグ終了時はデフォルトの動作をキャンセル

    console.log("[touchend] Dragging was in progress. Attempting to finalize drop or revert.");

    // ドロップ処理を実行
    if (currentDropZone) {
        console.log(`[touchend] Valid drop zone found: ${currentDropZone.id || currentDropZone.dataset.slotIndex}. Proceeding with processDrop.`);
        processDrop(draggingItemId, currentDropZone); // ★修正点: draggingItemId と currentDropZone を渡す★
    } else {
        // 有効なドロップゾーンがない場合、そのまま finishDragging を呼んでクリーンアップ。
        // 元の要素の復元は finishDragging 内で処理されます。
        console.log("[touchend] No valid drop zone was found. Calling finishDragging for cleanup and revert.");
        finishDragging(); // ★失敗時はfinishDraggingが元の状態に戻す★
    }
}

/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 * @param {Element} originalElement - 元の要素
 * @param {number} initialX - タッチ開始時のX座標
 * @param {number} initialY - タッチ開始時のY座標
 * @param {string} itemIdToClone - クローンするアイテムのID
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
    if (originalElement.classList.contains('drumsolo-active')) {
        currentTouchDraggedClone.classList.add('drumsolo-active');
    }

    // dataset コピー（これですべてのdata-*属性がコピーされるはずですが、特定属性の明示的なコピーも安全策として残します）
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone;

    // 特定データ属性も手動で確実にコピー（念のため）
    if (originalElement.dataset.isShortVersion) {
        currentTouchDraggedClone.dataset.isShortVersion = originalElement.dataset.isShortVersion;
    }
    if (originalElement.dataset.hasSeOption) {
        currentTouchDraggedClone.dataset.hasSeOption = originalElement.dataset.hasSeOption;
    }
    if (originalElement.dataset.hasDrumsoloOption) {
        currentTouchDraggedClone.dataset.hasDrumsoloOption = originalElement.dataset.hasDrumsoloOption;
    }
    if (originalElement.dataset.drumsoloChecked) {
        currentTouchDraggedClone.dataset.drumsoloChecked = originalElement.dataset.drumsoloChecked;
    }

    if (originalElement.dataset.rGt) {
        currentTouchDraggedClone.dataset.rGt = originalElement.dataset.rGt;
    }
    if (originalElement.dataset.lGt) {
        currentTouchDraggedClone.dataset.lGt = originalElement.dataset.lGt;
    }
    if (originalElement.dataset.bass) {
        currentTouchDraggedClone.dataset.bass = originalElement.dataset.bass;
    }
    if (originalElement.dataset.bpm) {
        currentTouchDraggedClone.dataset.bpm = originalElement.dataset.bpm;
    }
    if (originalElement.dataset.chorus) {
        currentTouchDraggedClone.dataset.chorus = originalElement.dataset.chorus;
    }

    document.body.appendChild(currentTouchDraggedClone);

    // ✅ セットリスト内のアイテムだった場合
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;  // ← 重要：スワップのためにここでセット
        const originalItemData = getSlotItemData(originalElement);
        if (originalItemData) {
            // 元のスロットのデータを一時的に保持
            originalSetlistSlot._originalItemData = originalItemData;
            console.log(`[createTouchDraggedClone] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex}`, originalItemData);
        }
        originalSetlistSlot.classList.add('placeholder-slot');
        originalElement.style.visibility = 'hidden'; // 元の要素を非表示にする
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else {
        // アルバムリストからのアイテム
        originalElement.style.visibility = 'hidden'; // 元のアルバムアイテムを非表示にする
        originalSetlistSlot = null; // アルバムからのドラッグなのでスロットはnull
        currentPcDraggedElement = originalElement; // ★修正点: モバイルでもアルバムアイテムの参照を保持
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録
    if (!originalAlbumMap.has(itemIdToClone)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId);
    }

    // クローンの位置調整
    // `initialX`, `initialY` を使用して初期位置を設定
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = originalElement.offsetWidth + 'px'; // 元の要素の幅に合わせる
    currentTouchDraggedClone.style.height = originalElement.offsetHeight + 'px'; // 元の要素の高さに合わせる
    currentTouchDraggedClone.style.left = initialX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - currentTouchDraggedClone.offsetHeight / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローン自体はイベントを受け取らない

    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}

/**
 * モバイルドラッグ中のクローン要素の位置を更新する（requestAnimationFrame用）
 * ★新規追加関数★
 * @param {TouchEvent} e タッチイベント
 */
function updateTouchDraggedClonePosition(e) {
    if (!isDragging || !currentTouchDraggedClone || !e.touches || e.touches.length === 0) {
        // ドラッグが終了しているか、クローンがない場合は更新を停止
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        return;
    }

    const touch = e.touches[0];
    currentTouchDraggedClone.style.left = touch.clientX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
    currentTouchDraggedClone.style.top = touch.clientY - currentTouchDraggedClone.offsetHeight / 2 + 'px';

    // 次のフレームで再度更新を要求
    // requestAnimationFrame は1回のリクエストで1フレームしか描画しないため、
    // 継続的に更新する場合はループ内でリクエストする必要がある。
    // しかし、ここでは `handleTouchMove` が継続的に呼び出されるため、
    // `updateTouchDraggedClonePosition(e)` は毎回 `requestAnimationFrame` を発行し、
    // 前の `rafId` をキャンセルして新しいものを設定する形式で問題ない。
    if (rafId) { // 前のフレーム要求をキャンセルして新しいものに置き換える
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => updateTouchDraggedClonePosition(e));
}


// main.js の finishDragging 関数

/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグで使われる currentPcDraggedElement のクリーンアップ
  // アルバムからのドラッグの場合、元のアイテムの表示を確実に元に戻す
  if (currentPcDraggedElement) {
      if (setlist.contains(currentPcDraggedElement)) {
          // セットリスト内の要素だった場合、placeholder-slot クラスを削除
          currentPcDraggedElement.classList.remove("dragging", "placeholder-slot");
          // visible 状態は originalSetlistSlot のロジックで制御されるため、ここでは変更しない
      } else {
          // アルバムからのドラッグ要素だった場合
          currentPcDraggedElement.classList.remove("dragging");
          // visibility が hidden ならば元に戻す
          if (currentPcDraggedElement.style.visibility === 'hidden') {
              currentPcDraggedElement.style.visibility = '';
              console.log(`[finishDragging] Restored visibility for PC dragged album item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
          }
      }
      currentPcDraggedElement = null; // 必ずnullにリセット
  }


  // モバイルドラッグ用のクローン要素の削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null;

  // originalSetlistSlot が存在する場合の処理
  if (originalSetlistSlot) {
      // placeholder-slot クラスを削除
      originalSetlistSlot.classList.remove('placeholder-slot');
      console.log(`[finishDragging] Removed 'placeholder-slot' class for originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex}.`);

      // ★重要: ドラッグ開始スロットが非表示になっている場合、常に可視に戻す★
      // ここで visibility を確実に 'visible' に設定します。
      if (originalSetlistSlot.style.visibility === 'hidden') {
          originalSetlistSlot.style.visibility = ''; // '' に設定すると、CSSや親からの継承に戻る
          console.log(`[finishDragging] Ensured originalSetlistSlot ${originalSetlistSlot.dataset.slotIndex} visibility is restored.`);
      }

      // ★重要: originalSetlistSlot._originalItemData が残っている = 移動またはスワップが未完了 or キャンセルされた状態
      // かつ、元のスロットが空になっている（データが失われている）場合にのみ復元
      // または、元のスロットに戻された場合 (processDropで処理されていない場合)
      if (originalSetlistSlot._originalItemData) {
          // ドロップが成功しなかった場合、または同じスロットに戻された場合（processDropで処理されなかった場合）
          // originalSetlistSlot に data-item-id が残っていない、つまりスロットがクリアされた状態であれば復元
          // または、draggingItemId が元のスロットIDと同じ場合（＝元のスロットに戻ったが、データは消えたままの場合）
          if (!originalSetlistSlot.dataset.itemId) { // スロットが空になっていることを確認
             console.log(`[finishDragging] Drag failed or returned to original slot, and original slot is empty. Restoring original item to slot ${originalSetlistSlot.dataset.slotIndex}.`);
             fillSlotWithItem(originalSetlistSlot, originalSetlistSlot._originalItemData);
          } else {
              console.log(`[finishDragging] Original slot ${originalSetlistSlot.dataset.slotIndex} still contains an item. No restoration needed.`);
          }
          delete originalSetlistSlot._originalItemData;
          console.log(`[finishDragging] Cleared _originalItemData for slot ${originalSetlistSlot.dataset.slotIndex}.`);
      }
  }

  // 全てのセットリストスロットからドラッグ関連のクラスを削除
  document.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target');
    slot.style.opacity = ''; // 必要であれば透明度もリセット
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // グローバル変数のリセット
  currentDropZone = null;
  activeTouchSlot = null;
  draggingItemId = null;
  isDragging = false;
  originalSetlistSlot = null; // ここで null にすることで、次のドラッグ開始時に状態がリセットされる

  // タイマーやアニメーションフレームのクリア
  if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
  }

  // メニュー内のアルバムアイテムの表示状態を更新
  hideSetlistItemsInMenu();

  console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
}






// main.js に追加
function revertDrag() {
    console.log("[revertDrag] Reverting drag operation.");
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }
    // PCドラッグの場合は、currentPcDraggedElement を元に戻す
    if (currentPcDraggedElement) {
        currentPcDraggedElement.style.display = ''; // 非表示にしていた元の要素を再表示
        currentPcDraggedElement.classList.remove('dragging'); // クラスを削除
        currentPcDraggedElement = null;
    }
    // ドロップゾーンのハイライトを解除
    const dropZones = document.querySelectorAll('.setlist-slot.drag-over');
    dropZones.forEach(zone => zone.classList.remove('drag-over', 'active-drop-target'));

    isDragging = false;
    draggingItemId = null;
    originalSetlistSlot = null;
    currentDropZone = null;
}


// main.js の processDrop 関数

/**
 * ドロップされたアイテムの処理
 * @param {string} droppedItemId - ドロップされたアイテムのID
 * @param {HTMLElement} dropZone - ドロップされたターゲット要素（セットリストのスロットまたはゴミ箱）
 */
function processDrop(droppedItemId, dropZone) {
    console.log(`[processDrop] Dropping item ${droppedItemId} onto`, dropZone);

    if (!droppedItemId) {
        console.warn("[processDrop] No droppedItemId found. Aborting drop.");
        return; // finishDragging は呼び出し元で処理されるのでここでは不要
    }

    const targetSlotIndex = dropZone.dataset.slotIndex ? parseInt(dropZone.dataset.slotIndex) : -1;

    // ゴミ箱にドロップされた場合
    if (dropZone.id === 'trashCan') {
        console.log(`[processDrop] Item ${droppedItemId} dropped on trash can.`);
        // originalSetlistSlot が存在する場合（セットリストからのドラッグ）
        if (originalSetlistSlot) {
            console.log(`[processDrop] Removing item from original setlist slot ${originalSetlistSlot.dataset.slotIndex}.`);
            clearSlotContent(parseInt(originalSetlistSlot.dataset.slotIndex));
            restoreToOriginalList(originalSetlistSlot); // 元のセットリストスロットを渡すことで、itemIdを取得しメニュー表示も更新
        } else {
            // アルバムからのアイテムをゴミ箱に捨てた場合
            // この場合、アルバムアイテムは単に非表示にされていたものを元に戻す
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (albumItem) {
                restoreToOriginalList(albumItem); // アルバムアイテムをゴミ箱に捨てた場合、非表示になっているものを表示に戻す
            }
        }
        showMessageBox('アイテムを削除しました。');
        return; // finishDragging は呼び出し元で処理されるのでここでは不要
    }

    // ドロップ先がセットリストスロットでない場合
    if (!dropZone.classList.contains('setlist-slot')) {
        console.warn("[processDrop] Drop zone is not a setlist slot. Reverting drag.");
        return; // finishDragging は呼び出し元で処理されるのでここでは不要
    }

    // ドラッグ中のアイテムのデータ（アルバムアイテムから、または元のセットリストスロットから）
    let draggedItemData;
    if (originalSetlistSlot) {
        // セットリスト内でのドラッグ（元々のスロットにデータが一時保存されているはず）
        draggedItemData = originalSetlistSlot._originalItemData;
        console.log("[processDrop] Dragged item data from originalSetlistSlot._originalItemData:", draggedItemData);
    } else {
        // アルバムリストからドラッグされた場合
        const albumItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
        draggedItemData = getSlotItemData(albumItem);
        console.log("[processDrop] Dragged item data from album item:", draggedItemData);
    }

    if (!draggedItemData) {
        console.error("[processDrop] Critical: draggedItemData is null. Cannot proceed with drop.");
        return; // finishDragging は呼び出し元で処理されるのでここでは不要
    }

    // ドロップ先のスロットが既に埋まっているかを確認
    const targetSlotHasItem = dropZone.classList.contains('setlist-item');
    const targetSlotCurrentItemData = targetSlotHasItem ? getSlotItemData(dropZone) : null;

    if (originalSetlistSlot === null) {
        // アルバムリストからドラッグされたアイテムの場合
        if (targetSlotHasItem) {
            // ドロップ先が埋まっている場合はスワップ
            console.log(`[processDrop] Swapping album item ${droppedItemId} with existing item in slot ${targetSlotIndex}.`);
            // ★修正: スワップ時には、既存アイテムをアルバムに戻す処理が必要
            if (targetSlotCurrentItemData) {
                restoreToOriginalList(targetSlot); // ドロップ先のアイテムをアルバムに戻す
            }
            // ドロップ先のスロットをドラッグしたアイテムで埋める
            draggedItemData.slotIndex = targetSlotIndex; // ターゲットスロットのインデックスをセット
            fillSlotWithItem(dropZone, draggedItemData);
            // 元のアルバムアイテムを非表示にする
            const albumItemToHide = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (albumItemToHide) albumItemToHide.style.visibility = 'hidden';

            showMessageBox('アイテムを入れ替えました。');
        } else {
            // 空のスロットにアルバムアイテムを追加
            console.log(`[processDrop] Adding album item ${droppedItemId} to empty slot ${targetSlotIndex}.`);
            draggedItemData.slotIndex = targetSlotIndex; // ターゲットスロットのインデックスをセット
            fillSlotWithItem(dropZone, draggedItemData);
            // 元のアルバムアイテムを非表示にする
            const albumItemToHide = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (albumItemToHide) albumItemToHide.style.visibility = 'hidden';

            showMessageBox(`${draggedItemData.name} を追加しました`);
        }
    } else {
        // セットリスト内での移動・スワップ
        const originalSlotIndex = parseInt(originalSetlistSlot.dataset.slotIndex);
        console.log(`[processDrop] Moving/Swapping setlist item from slot ${originalSlotIndex} to slot ${targetSlotIndex}.`);

        if (originalSlotIndex === targetSlotIndex) {
            // 同じスロットに戻された場合
            console.log(`[processDrop] Item ${droppedItemId} dropped back into its original slot ${originalSlotIndex}.`);
            // originalSetlistSlot は finishDragging で自動的に復元されるので、ここでは何もしない
            showMessageBox('元の位置に戻しました。');
        } else {
            // スロット間で移動またはスワップ
            if (targetSlotHasItem) {
                // スワップ (ターゲットスロットが埋まっている場合)
                console.log(`[processDrop] Swapping item from ${originalSlotIndex} with item in ${targetSlotIndex}.`);

                // ★ここが重要★
                // originalSetlistSlot の内容を dropZone に
                // dropZone の内容を originalSetlistSlot に
                // データをコピーしてfillSlotWithItemで書き換える
                const originalItemData = originalSetlistSlot._originalItemData; // ドラッグ開始時に保存したデータ
                const targetItemData = getSlotItemData(dropZone); // ドロップ先の現在のアイテムデータ

                // ドロップ先のスロットを、ドラッグ元（originalSetlistSlot）のアイテムデータで埋める
                originalItemData.slotIndex = targetSlotIndex; // 新しいスロットインデックスを設定
                fillSlotWithItem(dropZone, originalItemData);

                // ドラッグ元のスロットを、ドロップ先のアイテムデータで埋める
                // ドロップ先が元々空だった場合は、clearSlotContent で空にする
                if (targetItemData) {
                    targetItemData.slotIndex = originalSlotIndex; // 新しいスロットインデックスを設定
                    fillSlotWithItem(originalSetlistSlot, targetItemData);
                } else {
                    clearSlotContent(originalSlotIndex);
                }

                showMessageBox('アイテムを入れ替えました。');
            } else {
                // 移動 (空のスロットへ)
                console.log(`[processDrop] Moving item from ${originalSlotIndex} to empty slot ${targetSlotIndex}.`);

                const originalItemData = originalSetlistSlot._originalItemData; // ドラッグ開始時に保存したデータ

                // ドロップ先のスロットをドラッグ元のアイテムデータで埋める
                originalItemData.slotIndex = targetSlotIndex; // 新しいスロットインデックスを設定
                fillSlotWithItem(dropZone, originalItemData);

                // ドラッグ元のスロットをクリアする
                clearSlotContent(originalSlotIndex);

                showMessageBox('アイテムを移動しました。');
            }
        }
    }
    // processDrop の後、呼び出し元 (handleDrop, handleTouchEnd) で finishDragging が呼ばれることを想定
}

// main.js に追加していた swapSetlistItemSlots, moveSetlistItemToEmptySlot, swapItems, addItemToSetlist を削除
// これらのロジックは processDrop に統合または簡略化されました
// 必要に応じてこれらの関数自体は残し、processDrop から呼び出す形でもOKです。
// ただし、重複ロジックは避けるべきです。
// 今回の修正では、processDrop 内で直接処理するようにしています。


/**
 * セットリストのスロット間でアイテムをスワップする。
 * @param {Element} sourceSlot - 移動元のセットリストスロット要素
 * @param {Element} targetSlot - 移動先のセットリストスロット要素
 */
function swapSetlistItemSlots(sourceSlot, targetSlot) {
    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) return;

    const sourceData = getSlotItemData(sourceSlot);
    const targetData = getSlotItemData(targetSlot);

    if (sourceData) {
        // ターゲットスロットにソースデータを埋め込む (元のインデックスを上書きしないように注意)
        const originalTargetSlotIndex = targetData ? targetData.slotIndex : targetSlot.dataset.slotIndex;
        sourceData.slotIndex = originalTargetSlotIndex; // 移動先のスロットインデックスを設定
        fillSlotWithItem(targetSlot, sourceData);
        console.log(`[swapSetlistItemSlots] Moved item ${sourceData.itemId} from ${sourceSlot.dataset.slotIndex} to ${targetSlot.dataset.slotIndex}.`);
    }

    if (targetData) {
        // ソーススロットにターゲットデータを埋め込む
        const originalSourceSlotIndex = sourceData ? sourceData.slotIndex : sourceSlot.dataset.slotIndex;
        targetData.slotIndex = originalSourceSlotIndex; // 移動元のスロットインデックスを設定
        fillSlotWithItem(sourceSlot, targetData);
        console.log(`[swapSetlistItemSlots] Moved item ${targetData.itemId} from ${targetSlot.dataset.slotIndex} to ${sourceSlot.dataset.slotIndex}.`);
    } else {
        // ターゲットスロットが空だった場合、ソーススロットをクリア
        clearSlotContent(parseInt(sourceSlot.dataset.slotIndex)); // 修正点: 引数修正
    }
}

/**
 * セットリストのアイテムを空のスロットに移動する。
 * @param {Element} sourceSlot - 移動元のセットリストスロット要素
 * @param {Element} targetSlot - 移動先のセットリストスロット要素 (空であること)
 */
function moveSetlistItemToEmptySlot(sourceSlot, targetSlot) {
    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) return;

    const sourceData = getSlotItemData(sourceSlot);

    if (sourceData) {
        // ターゲットスロットにソースデータを埋め込む
        sourceData.slotIndex = parseInt(targetSlot.dataset.slotIndex); // 移動先のスロットインデックスを設定
        fillSlotWithItem(targetSlot, sourceData);
        console.log(`[moveSetlistItemToEmptySlot] Moved item ${sourceData.itemId} from ${sourceSlot.dataset.slotIndex} to empty slot ${targetSlot.dataset.slotIndex}.`);

        // 元のスロットをクリアする
        clearSlotContent(parseInt(sourceSlot.dataset.slotIndex)); // 修正点: 引数修正
    }
}

/**
 * アルバムアイテムをセットリスト内の既存アイテムとスワップする。
 * @param {string} albumItemId - アルバムからドラッグされたアイテムのID
 * @param {Element} targetSlot - スワップ先のセットリストスロット要素
 */
function swapItems(albumItemId, targetSlot) {
    const albumItem = document.querySelector(`.album-content .item[data-item-id="${albumItemId}"]`);
    if (!albumItem) {
        console.error("[swapItems] Album item not found for ID:", albumItemId);
        return;
    }

    const albumItemData = getSlotItemData(albumItem);
    const targetSlotData = getSlotItemData(targetSlot);

    // セットリストから元のアルバムリストに戻すアイテムを処理
    if (targetSlotData) {
        restoreToOriginalList(targetSlot); // targetSlotのアイテムをアルバムに戻す
        console.log(`[swapItems] Existing item ${targetSlotData.itemId} from slot ${targetSlot.dataset.slotIndex} restored to album.`);
    }

    // アルバムアイテムをターゲットスロットに配置
    if (albumItemData) {
        albumItemData.slotIndex = parseInt(targetSlot.dataset.slotIndex); // 移動先のスロットインデックスを設定
        fillSlotWithItem(targetSlot, albumItemData);
        albumItem.style.visibility = 'hidden'; // アルバムメニューから非表示にする
        console.log(`[swapItems] Album item ${albumItemId} placed into slot ${targetSlot.dataset.slotIndex}.`);
    } else {
        console.warn("[swapItems] No data for album item:", albumItemId);
    }
    showMessageBox('アイテムを入れ替えました。');
}



/**
 * 指定されたアイテムをセットリストの指定されたスロットに追加する。
 * ★新規追加関数★
 * @param {string} itemId 追加するアイテムのID
 * @param {number} slotIndex 追加するスロットのインデックス
 */
function addItemToSetlist(itemId, targetSlotIndex) {
    const targetSlot = document.querySelector(`.setlist-slot[data-slot-index="${targetSlotIndex}"]`);
    if (targetSlot) {
        // アルバムアイテムからデータを取得
        const sourceItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (sourceItem) {
            const itemData = getSlotItemData(sourceItem); // ここで取得されるitemDataにはslotIndexがない

            // --- ここに修正を加えます ---
            // targetSlotIndex を itemData に追加する
            itemData.slotIndex = targetSlotIndex;

            fillSlotWithItem(targetSlot, itemData);
            hideSetlistItemsInMenu();
            showMessageBox(`${itemData.name} を追加しました`);
            return true;
        }
    }
    return false;
}


function handleDoubleClick(e) {
    // イベントの伝播を停止し、親要素のダブルクリックイベントが発火しないようにする
    e.stopPropagation();
    console.log("[handleDoubleClick] Double click detected on element:", e.target.closest('.item, .setlist-slot'));

    const itemElement = e.target.closest('.item, .setlist-slot'); // .item または .setlist-slot を持つ親要素を取得
    if (!itemElement) {
        console.log("[handleDoubleClick] No item element found.");
        return;
    }

    const itemId = itemElement.dataset.itemId;
    console.log("[handleDoubleClick] Double click on item ID:", itemId);

    // ダブルクリックされた要素がアルバムリスト（ハンバーガーメニュー）にある場合
    // .album-content の子孫要素であり、かつ .setlist-slot クラスを持たない要素
    if (itemElement.closest('.album-content') && !itemElement.classList.contains('setlist-slot')) {
        console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
        const nextEmptySlotIndex = findNextEmptySetlistSlot();
        if (nextEmptySlotIndex !== -1) {
            addItemToSetlist(itemId, nextEmptySlotIndex);
            // セットリストに追加後、元のアルバムアイテムを非表示にする
            // これはドラッグ＆ドロップで追加した場合と同じ挙動にするため
            itemElement.style.visibility = 'hidden'; // アルバムメニューからアイテムを隠す (display: 'none' から visibility: 'hidden' に変更)
            console.log("[handleDoubleClick] Hiding original album item:", itemId);
        } else {
            showMessageBox("セットリストに空きがありません。");
        }
    }
    // ダブルクリックされた要素がセットリストにある場合
    else if (itemElement.closest('.setlist-items') && itemElement.classList.contains('setlist-slot')) {
        console.log("[handleDoubleClick] Item " + itemId + " is in setlist. Attempting to remove from setlist.");
        const slotIndex = parseInt(itemElement.dataset.slotIndex, 10);

        // セットリストからアイテムを削除し、アルバムメニューに戻す処理
        if (clearSlotContent(slotIndex)) { // clearSlotContent はアイテムを削除する関数と仮定
            // アルバムメニューの対応するアイテムを再表示する
            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItem) {
                albumItem.style.visibility = ''; // visibilityスタイルをリセットして表示 (display: '' から visibility: '' に変更)
                console.log("[handleDoubleClick] Showing album item in menu:", itemId);
            }
            hideSetlistItemsInMenu(); // メニュー表示状態を更新
            showMessageBox(`${itemElement.dataset.songName} をセットリストから削除しました`);
        }
    } else {
        console.log("[handleDoubleClick] No specific action defined for double click on this element.");
    }

    // ドラッグ操作のクリーンアップ（ダブルクリック後にドラッグ状態が残るのを防ぐ）
    finishDragging(); // finishDraggingはグローバルなドラッグ状態をリセットすると仮定
}


/**
 * 次の空いているセットリストスロットを見つける。
 * @returns {number} 空いているスロットのインデックス。見つからない場合は -1。
 */
function findNextEmptySetlistSlot() {
    // セットリストのスロット要素をすべて取得
    const setlistSlots = document.querySelectorAll('.setlist-slot');

    for (let i = 0; i < setlistSlots.length; i++) {
        const slot = setlistSlots[i];
        // スロットにアイテムが埋まっていないか（子要素に.itemがないか）をチェック
        // または、data-item-idがセットされていないかをチェック
        if (!slot.classList.contains('setlist-item')) { // setlist-item クラスがない＝空と判断
            console.log(`[findNextEmptySetlistSlot] Found empty slot at index: ${i}`);
            return i; // 空のスロットのインデックスを返す
        }
    }
    console.log("[findNextEmptySetlistSlot] No empty setlist slot found.");
    return -1; // 空きスロットが見つからなかった場合
}





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

// 修正点: 日本語フォント登録関数をグローバルスコープに追加 (jsPDFで使用)
// Noto Sans JP の Base64 エンコードデータは非常に長いため、ここでは簡略化して示します。
// 実際のプロジェクトでは、別途フォントファイルを読み込むか、Base64文字列を埋め込む必要があります。
// 詳細はjsPDFのドキュメントを参照してください。
function registerJapaneseFont(doc) {
    // 実際には、以下のようにフォントデータを追加します。
    // doc.addFileToVFS('NotoSansJP-Regular.ttf', 'YOUR_BASE64_ENCODED_FONT_DATA_HERE');
    // doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    // doc.addFileToVFS('NotoSansJP-Bold.ttf', 'YOUR_BASE64_ENCODED_FONT_DATA_HERE');
    // doc.addFont('NotoSansJP-Bold.ttf', 'NotoSansJP', 'bold');
    // 現在はフォントファイルがないため、警告を出力します
    console.warn("[registerJapaneseFont] Japanese font registration is a placeholder. Please ensure 'NotoSansJP' font files are correctly embedded/loaded for actual PDF output with Japanese characters.");
}


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
    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

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
            // 修正点: ヘッダーフォントサイズをさらに大きく調整
            simplePdf.setFontSize(simpleFontSize + 8); // 例: 32 + 8 = 40pt
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            // 修正点: ヘッダーテキストと曲リストの間の余白を大幅に増やす
            simpleYPos += simpleFontSize * 1.5; // フォントサイズの1.5倍程度の余白に調整
            simplePdf.setFontSize(simpleFontSize); // サイズを曲リスト用に戻す
        }

        // 各曲目をテキストとして追加
        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            // 修正点: 曲間の行の高さをフォントサイズに合わせて調整
            simpleYPos += simpleFontSize * 1.25; // フォントサイズの1.25倍程度の行間隔に調整

            // ページ下部に近づいたら新しいページを追加
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
              // 修正点: clearSlotContent の呼び出しから `setlist` 引数を削除
              clearSlotContent(i); // slotIndex は数値で渡す
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

                    // 修正点: updateDays 関数がグローバルスコープにあることを前提とする
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
          // 修正点: updateDays 関数がグローバルスコープにあることを前提とする
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

// 修正点: `updateDays` 関数をグローバルスコープに移動
/**
 * 日のドロップダウンを更新する関数。
 * @param {HTMLSelectElement} setlistYear - 年のselect要素
 * @param {HTMLSelectElement} setlistMonth - 月のselect要素
 * @param {HTMLSelectElement} setlistDay - 日のselect要素
 */
const updateDays = () => { // グローバル関数として定義
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

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
