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

const DOUBLE_TAP_DELAY = 350;
const TAP_MOVE_THRESHOLD = 10; // ドラッグ開始とみなす移動距離のしきい値 (px)
let initialTouchX = 0;
let initialTouchY = 0;
let isDraggingTouch = false;
let currentDraggedItem = null;




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
 * セットリストのアイテムを元のアルバムリストに戻し、そのセットリストスロットを空の状態にする。
 * この関数は、主にダブルタップでのセットリストからの削除、またはドラッグ&ドロップでの置換時に呼び出されます。
 * @param {HTMLElement} setlistItemElement - セットリストから削除し、空にする対象の `setlist-slot` か `setlist-item` 要素。
 */
function restoreToOriginalList(setlistItemElement) {
    if (!setlistItemElement || !setlistItemElement.dataset.itemId) {
        console.warn("[restoreToOriginalList] Invalid setlist item element provided. Cannot restore.", setlistItemElement);
        return;
    }

    const itemId = setlistItemElement.dataset.itemId;
    console.log(`[restoreToOriginalList] Restoring item ID: ${itemId} from setlist.`);

    // 1. 元のアルバムアイテムを表示に戻す
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.visibility = ''; // 非表示を解除
        albumItemInMenu.style.display = '';    // display: none も解除
        console.log(`[restoreToOriginalList] Original album item found and re-displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display. It might have been added by ID directly.`);
    }

    // 2. セットリスト内の該当スロットのコンテンツをクリアし、空の状態にリセットする
    // 引数として渡された setlistItemElement が、そのままクリア対象のスロットであると仮定
    console.log(`[restoreToOriginalList] Clearing content and resetting setlist slot: ${setlistItemElement.dataset.slotIndex || 'N/A'} for item ${itemId}`);
    
    setlistItemElement.innerHTML = ''; // スロットの内容を空にする
    setlistItemElement.classList.remove('setlist-item', 'short', 'se-active', 'drumsolo-active'); // アイテム関連のクラスを削除
    setlistItemElement.classList.add('setlist-slot-empty'); // 空スロットであることを示すクラスを付与

    // データ属性もクリアする (重要: 前のアイテムの情報が残らないように)
    // datasetからitemId, titleなどの全てのカスタムデータ属性を削除
    for (const key in setlistItemElement.dataset) {
        if (key.startsWith('item') || key.startsWith('isShortVersion') || key.startsWith('hasSeOption') || 
            key.startsWith('hasDrumsoloOption') || key === 'short' || key === 'seChecked' || key === 'drumsoloChecked' ||
            key === 'songName' || key === 'rGt' || key === 'lGt' || key === 'bass' || key === 'bpm' || key === 'chorus' ||
            key === 'initialized') { // initializeSetlistItem で設定される 'initialized' も削除
            delete setlistItemElement.dataset[key];
        }
    }
    // slotIndex はスロット固有のIDなので残す
    
    // MutationObserverによって initializeSetlistItem が再び呼ばれる余地を作る
    // もし initializeSetlistItem が dataset.initialized を見てスキップするなら、ここで削除しておく

    // 3. originalAlbumMap からエントリを削除（該当する場合）
    if (originalAlbumMap.has(itemId)) {
        originalAlbumMap.delete(itemId);
        console.log(`[restoreToOriginalList] Deleted ${itemId} from originalAlbumMap.`);
    }

    // 4. セットリスト内のアイテム表示を更新（メニュー内の表示/非表示を再計算）
    hideSetlistItemsInMenu(); 
    console.log(`[restoreToOriginalList] hideSetlistItemsInMenu called.`);
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
 */
function fillSlotWithItem(slotElement, songData) {
  console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex || 'N/A'} with item ID: ${songData.itemId}`);
  console.log(`[fillSlotWithItem]   songData received:`, songData);

  // 1. スロットが既にアイテムを持っている場合、既存のアイテムを元のリストに戻す
  // これにより、重複やデータ不整合を防ぐ。
  if (slotElement.classList.contains('setlist-item')) {
      console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex || 'N/A'} already contains an item (${slotElement.dataset.itemId}). Restoring old item first.`);
      restoreToOriginalList(slotElement); // 既存アイテムを元のリストに戻す
  }

  // 2. スロットのクラスをリセットし、新しいアイテムのクラスを追加
  // restoreToOriginalList で大部分はクリアされるが、念のため
  slotElement.classList.remove('setlist-slot-empty'); // 空スロットのクラスを削除
  slotElement.classList.add('setlist-item'); // アイテムがあることを示すクラスを追加
  slotElement.classList.add('item'); // 互換性のため 'item' クラスも追加

  if (songData.albumClass) {
    slotElement.classList.add(songData.albumClass); // アルバムクラスを再追加
  }

  // 3. データ属性を更新
  slotElement.dataset.itemId = songData.itemId;
  slotElement.dataset.songName = songData.name;
  slotElement.dataset.isShortVersion = songData.hasShortOption ? 'true' : 'false'; 
  slotElement.dataset.hasSeOption = songData.hasSeOption ? 'true' : 'false';
  slotElement.dataset.hasDrumsoloOption = songData.hasDrumsoloOption ? 'true' : 'false'; // ドラムソロオプションの有無

  slotElement.dataset.short = songData.short ? 'true' : 'false'; // 現在のチェック状態
  slotElement.dataset.seChecked = songData.seChecked ? 'true' : 'false'; // 現在のチェック状態
  slotElement.dataset.drumsoloChecked = songData.drumsoloChecked ? 'true' : 'false'; // 現在のチェック状態

  slotElement.dataset.rGt = songData.rGt || '';
  slotElement.dataset.lGt = songData.lGt || '';
  slotElement.dataset.bass = songData.bass || '';
  slotElement.dataset.bpm = songData.bpm || '';
  slotElement.dataset.chorus = songData.chorus || '';

  // 4. スロットのinnerHTMLを構築
  let optionsHtml = '';
  if (songData.hasShortOption) {
      optionsHtml += `
          <span class="checkbox-wrapper">
              <input type="checkbox" data-option-type="short" ${songData.short ? 'checked' : ''}>
              <span class="short-label">(Short)</span>
          </span>`;
  }
  if (songData.hasSeOption) {
      optionsHtml += `
          <span class="checkbox-wrapper">
              <input type="checkbox" data-option-type="se" ${songData.seChecked ? 'checked' : ''}>
              <span class="se-label">(SE有り)</span>
          </span>`;
  }
  if (songData.hasDrumsoloOption) {
      optionsHtml += `
          <span class="checkbox-wrapper">
              <input type="checkbox" data-option-type="drumsolo" ${songData.drumsoloChecked ? 'checked' : ''}>
              <span class="drumsolo-label">(ドラムソロ有り)</span>
          </span>`;
  }

  // 追加情報の構築
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
  const additionalInfoHtml = infoParts.length > 0 ? `<div class="additional-song-info">${infoParts.join(' | ')}</div>` : '';


  slotElement.innerHTML = `
      <div class="drag-handle">☰</div>
      <div class="song-info-container">
          <div class="song-name-and-option">
              ${songData.name}
              ${optionsHtml}
          </div>
          ${additionalInfoHtml}
      </div>
  `;

  // 5. クラスをトグルして視覚的な状態を反映
  slotElement.classList.toggle('short', songData.short);
  slotElement.classList.toggle('se-active', songData.seChecked);
  slotElement.classList.toggle('drumsolo-active', songData.drumsoloChecked); // ドラムソロのアクティブクラス

  // 6. イベントリスナーを再設定 (initializeSetlistItemを呼び出す)
  // MutationObserverが監視している場合は、innerHTMLの変更で自動的にinitializeSetlistItemが呼ばれるはずですが、
  // 確実性を高めるため、ここで明示的に呼び出すことも可能です。
  // ただし、initializeSetlistItem内で既に初期化されているかチェックするように設計されている必要があります。
  initializeSetlistItem(slotElement);
  console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex || 'N/A'} content updated and re-initialized.`);

  hideSetlistItemsInMenu(); // メニューのアイテム表示を更新
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
        draggedItemData = getSlotItemData(draggedElement);

        const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (originalAlbumItem) {
            draggedItemData.hasShortOption = originalAlbumItem.dataset.isShortVersion === 'true';
            draggedItemData.hasSeOption = originalAlbumItem.dataset.hasSeOption === 'true';
            draggedItemData.hasDrumsoloOption = originalAlbumItem.dataset.hasDrumsoloOption === 'true'; // ★追加: ドラムソロオプションの有無
        }
        // ★ここまで追加★

        console.log("[processDrop] Using data from draggedElement (and enriched for album item):", draggedItemData);
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
 * PC環境でのドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベントオブジェクト
 */
function handleDrop(event) {
    event.preventDefault(); // デフォルトのドロップ動作（例: ファイルを開く）を抑制
    event.stopPropagation(); // イベントの伝播を停止 (必要に応じて)
    console.log("[handleDrop] PC Drop event fired.");

    // PCドラッグで dataTransfer からアイテムIDを取得
    const droppedItemId = event.dataTransfer.getData("text/plain");
    console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

    // PCドラッグの場合、draggedItem は基本的に currentPcDraggedElement（handleDragStartで設定されたもの）を指す
    let draggedItemSourceElement = currentPcDraggedElement;
    
    // もし currentPcDraggedElement が設定されていない場合（念のため）、IDから探す
    // ただし、通常は handleDragStart で必ず設定されているはず
    if (!draggedItemSourceElement && droppedItemId) {
        draggedItemSourceElement = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`) ||
                                   document.querySelector(`.setlist-slot.setlist-item[data-item-id="${droppedItemId}"]`);
        console.warn("[handleDrop] currentPcDraggedElement was null, trying to find draggedItemSourceElement by ID.");
    }

    if (!draggedItemSourceElement) {
        console.error("[handleDrop] draggedItemSourceElement (original element) not found or invalid with itemId:", droppedItemId);
        finishDragging(); // ドラッグ状態をクリーンアップ
        return;
    }
    console.log("[handleDrop] draggedItemSourceElement found:", draggedItemSourceElement);

    // ドロップターゲットとなるセットリストスロットを探す
    const dropTargetSlot = event.target.closest('.setlist-slot');
    console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

    // ドロップターゲットが有効なセットリストスロットだった場合
    if (dropTargetSlot) {
        // processDrop関数に処理を委譲
        // processDrop(draggedItemSourceElement, dropTargetSlot, isFromSetlist);
        // isFromSetlist の代わりに、draggedItemSourceElement が setlist.contains しているかどうかで判断
        const isFromSetlist = draggedItemSourceElement.classList.contains('setlist-item');
        processDrop(draggedItemSourceElement, dropTargetSlot, isFromSetlist);

    } else {
        // ドロップターゲットがセットリストスロット外だった場合
        console.warn("[handleDrop] Dropped outside a setlist slot. Restoring dragged item to its original location if applicable.");
        
        // 元々セットリスト内のアイテムだった場合、そのスロットを空にし、元のアルバムアイテムを表示に戻す
        if (draggedItemSourceElement.classList.contains('setlist-item')) {
            // 元のスロット（currentPcDraggedElement自体）を空に戻す
            restoreToOriginalList(draggedItemSourceElement);
            console.log(`[handleDrop] Item ${draggedItemSourceElement.dataset.itemId} restored from setlist to album list (or original position).`);
        } else {
            // 元々アルバムリストのアイテムだった場合、単に非表示を解除する
            // (通常はドラッグ開始時に非表示にしているので、それを元に戻す)
            const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (originalAlbumItem) {
                originalAlbumItem.style.visibility = '';
                originalAlbumItem.style.display = '';
                console.log(`[handleDrop] Album item ${droppedItemId} visibility restored.`);
            }
        }
    }
    
    // ドラッグ状態のクリーンアップは必ず行う
    finishDragging();
}


// --- 新規/修正: processDrop 関数 ---
// handleDrop (PC) と handleTouchEnd (Mobile) の両方から呼び出される共通ロジック
/**
 * アイテムをドロップターゲットスロットに配置する共通処理。
 * @param {HTMLElement} draggedItemSourceElement - ドラッグされたアイテムの元の要素（アルバムアイテム or セットリストスロット）
 * @param {HTMLElement} dropTargetSlot - ドロップされたセットリストスロット要素
 * @param {boolean} isFromSetlist - ドラッグ開始元がセットリスト内かどうか
 */
function processDrop(draggedItemSourceElement, dropTargetSlot, isFromSetlist) {
    const itemId = draggedItemSourceElement.dataset.itemId;
    console.log(`[processDrop] Processing drop of item ${itemId} onto slot ${dropTargetSlot.dataset.slotIndex || 'N/A'}. From Setlist: ${isFromSetlist}`);

    // draggedItemSourceElementから最新のアイテムデータを取得 (オプションのチェック状態などを含む)
    const itemDataToMove = getSlotItemData(draggedItemSourceElement);
    if (!itemDataToMove) {
        console.error("[processDrop] Could not get item data for dragged source element:", draggedItemSourceElement);
        return;
    }

    const isDropTargetOccupied = dropTargetSlot.classList.contains('setlist-item');

    if (isDropTargetOccupied) {
        // ドロップ先が既にアイテムを持つスロットの場合
        console.log(`[processDrop] Dropped onto an occupied slot (${dropTargetSlot.dataset.itemId}).`);
        
        if (isFromSetlist) {
            // セットリスト内での並び替え：ターゲットスロットのアイテムと入れ替える
            const targetItemData = getSlotItemData(dropTargetSlot); // ターゲットスロットの現在のアイテムデータを取得
            if (!targetItemData) {
                console.error("[processDrop] Could not get target item data for occupied slot:", dropTargetSlot);
                return;
            }
            
            fillSlotWithItem(dropTargetSlot, itemDataToMove);     // ドロップ先に移動元のアイテムを入れる
            fillSlotWithItem(draggedItemSourceElement, targetItemData); // 移動元にターゲットアイテムを入れる
            
            console.log(`[processDrop] Reordered: Item ${itemId} swapped with ${targetItemData.itemId}.`);
        } else {
            // アルバムからのドラッグで、セットリスト内の既存アイテム上にドロップされた場合（置換）
            console.log(`[processDrop] Album item ${itemId} dropped onto occupied setlist slot. Replacing existing item.`);
            // fillSlotWithItem 内で既存アイテムの restoreToOriginalList が呼ばれる
            fillSlotWithItem(dropTargetSlot, itemDataToMove);
            // 元のアルバムアイテムの親リストを記録（あれば）
            const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (originalAlbumItem) {
                originalAlbumMap.set(itemId, originalAlbumItem.parentNode.id);
            }
        }
    } else {
        // ドロップ先が空のスロットの場合
        console.log(`[processDrop] Dropped onto an empty slot.`);
        
        if (isFromSetlist) {
            // セットリスト内での移動：元のスロットを空にし、ターゲットスロットを埋める
            restoreToOriginalList(draggedItemSourceElement); // 元のスロットを空にする
            console.log(`[processDrop] Original setlist item ${itemId} removed from old slot and its slot is cleared.`);
        }
        
        fillSlotWithItem(dropTargetSlot, itemDataToMove);
        
        // アルバムからの追加の場合のみ、元のアルバムアイテムの親リストを記録
        if (!isFromSetlist) {
            const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (originalAlbumItem) {
                originalAlbumMap.set(itemId, originalAlbumItem.parentNode.id);
            }
        }
    }
    updateSetlistSlotIndices(); // スロットのインデックスを更新
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
        lastTapTime = 0; // チェックボックス操作時はダブルタップ判定をリセット
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        isDragging = false;
        return;
    }

    const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");

    // ドラッグ対象ではない要素（例: 空のスロット、スクロールバー、メニューの空白など）の場合、
    // ここで処理を終了し、イベントのデフォルト動作（スクロールなど）を妨げない。
    if (!touchedElement) {
        console.log("[touchstart:Mobile] Touched non-draggable element. Allowing default behavior (e.g., scrolling).");
        return; // preventDefault() を呼ばない
    }

    // ドラッグ可能な要素がタッチされた場合、ダブルタップの判定を行う
    // (ダブルタップはスクロールと競合するため、ここでpreventDefaultを呼ぶ場合がある)
    if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) { // DOUBLE_TAP_DELAY を使用
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event); // ダブルタップ処理。内部でpreventDefault()を呼ぶ。
        lastTapTime = 0; // ダブルタップ処理後、時間をリセット
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return; // ダブルタップでイベントが消費されるため、これ以上ドラッグ処理は行わない
    }
    lastTapTime = currentTime; // 次のタップ判定のために時間を更新

    // ここからドラッグ開始候補の処理
    if (event.touches.length === 1) {
        console.log("[touchstart:Mobile] Touched draggable element (non-checkbox):", touchedElement);
        console.log("[touchstart:Mobile] Touched element itemId:", touchedElement.dataset.itemId);

        // ドラッグ開始フラグはまだfalseのまま
        isDragging = false;
        draggingItemId = touchedElement.dataset.itemId;

        // originalSetlistSlot の設定（セットリストからのドラッグの場合のみ）
        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
            console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex || 'N/A'}, data:`, originalSetlistSlot._originalItemData);
        } else {
            // アルバムからのドラッグの場合
            originalSetlistSlot = null;
            // アルバムアイテムのデータも必要に応じて取得・保存しておくと良い
            // originalSetlistSlot._originalItemData はセットリストからのドラッグの場合のみ使用
        }

        // initialTouchX/Y は、TAP_MOVE_THRESHOLD を超える移動があったかを判定するために使用
        initialTouchX = event.touches[0].clientX;
        initialTouchY = event.touches[0].clientY;

        // ドラッグ開始時のクローン位置計算用のオフセットを記録
        const rect = touchedElement.getBoundingClientRect();
        // クローン要素内のタッチ位置からのオフセットを計算 (左上隅からの相対位置)
        touchStartX = event.touches[0].clientX - rect.left;
        touchStartY = event.touches[0].clientY - rect.top;

        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // ⭐︎ ここにあった setTimeout によるロングプレスドラッグ開始ロジックは削除します ⭐︎
        // スクロールとの競合を避けるため、ドラッグは TAP_MOVE_THRESHOLD を超える動きでのみ開始します。
    }
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    // isDragging が true でない（まだドラッグが始まっていない）場合のみ、閾値判定を行う
    // isDragging が true であれば、すでにドラッグ中なので preventDefault を継続して呼び出す
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const currentClientX = touch.clientX;
        const currentClientY = touch.clientY;

        if (!isDragging) { // まだドラッグが開始されていない場合
            // タッチ開始地点からの移動距離を計算
            const deltaX = Math.abs(currentClientX - initialTouchX);
            const deltaY = Math.abs(currentClientY - initialTouchY);

            // TAP_MOVE_THRESHOLD を超えたらドラッグ開始とみなす
            if (deltaX > TAP_MOVE_THRESHOLD || deltaY > TAP_MOVE_THRESHOLD) {
                // ドラッグ開始に必要な要素が揃っているか確認
                const elementToDrag = originalSetlistSlot || document.querySelector(`.album-content .item[data-item-id="${draggingItemId}"]`);
                if (elementToDrag && draggingItemId) {
                    event.preventDefault(); // ここで初めてスクロールを抑制
                    // クローン作成。initialX, initialY はクローン位置の初期計算に使用。
                    // `touchStartX`, `touchStartY` はクローン上のタッチオフセットとして使用されるため、ここでは不要。
                    createTouchDraggedClone(elementToDrag, currentClientX, currentClientY, draggingItemId);
                    isDragging = true;
                    console.log("[handleTouchMove] Dragging initiated by movement (threshold exceeded). Preventing default scroll.");
                } else {
                    console.warn("[handleTouchMove] Movement detected, but cannot initiate drag (element missing or no draggingItemId). Allowing scroll.");
                    // ドラッグ開始条件を満たさない場合は、引き続きスクロールを許可
                    return;
                }
            } else {
                // 閾値を超えていない場合は、スクロールを許可し続ける
                return; // preventDefault() を呼ばない
            }
        }

        // isDragging が true の場合（ドラッグ中）は、常に preventDefault を呼び出し続ける
        // そしてクローンの位置を更新する
        if (isDragging && currentTouchDraggedClone) {
            event.preventDefault(); // ドラッグ中はスクロールを抑制
            
            // クローンの位置を更新
            // タッチ位置 (currentClientX, currentClientY) から、
            // クローン作成時に計算したオフセット (touchStartX, touchStartY) を引いて、クローンの左上隅を計算
            currentTouchDraggedClone.style.left = (currentClientX - touchStartX) + 'px';
            currentTouchDraggedClone.style.top = (currentClientY - touchStartY) + 'px';

            const targetElement = document.elementFromPoint(currentClientX, currentClientY);
            const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

            if (newDropZone !== currentDropZone) {
                if (currentDropZone) currentDropZone.classList.remove('drag-over');
                if (newDropZone) newDropZone.classList.add('drag-over');
                currentDropZone = newDropZone;
                console.log(`[handleTouchMove] Drop zone changed to: ${newDropZone ? newDropZone.dataset.slotIndex : 'None'}`);
            }

            // rafId のキャンセルとリクエストは、updateTouchDraggedClonePosition でラップするか、
            // 別途パフォーマンス最適化のために行うべきで、ここでは直接の更新で十分
            // （元のコードの rafId ロジックは複雑化していたため、このシンプルな形に変更）
        }
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

    if (!isDragging) { // ドラッグしていなかった場合
        if (!isCheckboxClick) { 
            console.log("[touchend] Not dragging, not a checkbox click. Allowing default behaviors.");
        } else {
            console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
        }
        return; // ドラッグしていなかったので、ここで処理を終了
    }
    
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging(); 
        return;
    }

    document.querySelectorAll('.setlist-slot.drag-over')
        .forEach(slot => slot.classList.remove('drag-over'));
    
    const touch = event.changedTouches[0];
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    finishDragging(); 
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 * @param {HTMLElement} originalElement - ドラッグを開始した元の要素 (setlist-slot.setlist-item または album-content .item)
 * @param {number} initialX - タッチ開始時のX座標 (pageX or clientX)
 * @param {number} initialY - タッチ開始時のY座標 (pageY or clientY)
 * @param {string} itemIdToClone - ドラッグ中のアイテムID
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    // 既存のクローンがあれば削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    // 元の要素が有効か、DOM内にあるかを確認
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body. Cannot create clone.");
        return;
    }

    // 1. クローン要素の作成と基本クラスの追加
    currentTouchDraggedClone = originalElement.cloneNode(true); // 子孫も含めて完全にクローン
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // 2. クラスとデータ属性のコピー
    // cloneNode(true) でほとんどのデータがコピーされるため、明示的なループで足りるはずです。
    // 個別のクラスやデータ属性のコピーは通常不要ですが、もし特定のCSSクラスの動的な状態(例: short, se-active, drumsolo-active)が
    // cloneNodeでコピーされない場合は、以下のように明示的にコピーするロジックが必要になります。
    // （classList.contains()で確認し、追加する形であれば安全です）

    // 動的に追加されるクラスのコピー（例: short, se-active, drumsolo-active）
    // originalElementが持っているクラスをそのままクローンにも適用
    if (originalElement.classList.contains('short')) {
        currentTouchDraggedClone.classList.add('short');
    }
    if (originalElement.classList.contains('se-active')) {
        currentTouchDraggedClone.classList.add('se-active');
    }
    if (originalElement.classList.contains('drumsolo-active')) {
        currentTouchDraggedClone.classList.add('drumsolo-active');
    }

    // datasetのコピー（cloneNode(true)でほとんどコピーされますが、念のため）
    // itemIdToClone は引数で渡されたものを優先
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; 
    // 他のデータ属性は cloneNode(true) で自動的にコピーされるため、明示的なループや個別コピーは削除します。
    // もし `getSlotItemData` などで取得できないデータがある場合は、ここで必要に応じて追加してください。

    // 3. クローンをbodyに追加
    document.body.appendChild(currentTouchDraggedClone);

    // 4. 元の要素の状態管理と originalSetlistSlot の設定
    // セットリスト内のアイテムだった場合、元のスロットを隠してプレースホルダーとする
    if (originalElement.classList.contains('setlist-item')) { // setlist.contains(originalElement) は不要、クラスで判別
        originalSetlistSlot = originalElement;  // ドラッグ開始された元のセットリストスロットを保持
        // originalItemData は handleDrop で必要になるため、ここで取得して保存
        originalSetlistSlot._originalItemData = getSlotItemData(originalElement); 
        console.log(`[createTouchDraggedClone] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex || 'N/A'}`, originalSetlistSlot._originalItemData);
        
        originalSetlistSlot.classList.add('placeholder-slot'); // プレースホルダーとしてマーク
        originalElement.style.visibility = 'hidden'; // 元の要素を非表示
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex || 'N/A'} marked as placeholder and hidden.`);
    } else {
        // アルバムリストからのアイテムの場合
        originalElement.style.visibility = 'hidden'; // 元のアルバムアイテムを非表示
        originalSetlistSlot = null; // アルバムからのドラッグなので originalSetlistSlot は null
        console.log(`[createTouchDraggedClone] Original album item ${itemIdToClone} hidden.`);
    }

    // 5. 元のリストの記録（ドラッグ開始元がアルバムリストの場合のみ記録）
    // すでに originalAlbumMap にある場合は更新不要
    if (!setlist.contains(originalElement) && !originalAlbumMap.has(itemIdToClone)) {
        const originalListId = originalElement.parentNode ? originalElement.parentNode.id : null;
        if (originalListId) {
            originalAlbumMap.set(itemIdToClone, originalListId);
            console.log(`[createTouchDraggedClone] Added ${itemIdToClone} to originalAlbumMap with parent ID: ${originalListId}.`);
        } else {
            console.warn(`[createTouchDraggedClone] Original parent ID not found for album item ${itemIdToClone}.`);
        }
    }

    // 6. クローンの初期位置とスタイル設定
    const rect = originalElement.getBoundingClientRect();
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = rect.width + 'px';
    currentTouchDraggedClone.style.height = rect.height + 'px';
    // クローンの中心をタッチ開始位置に合わせる
    currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローンが他のイベントをブロックしないように

    console.log(`[createTouchDraggedClone] Clone created and positioned for itemId=${itemIdToClone}.`);
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ終了時のクリーンアップ
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグ中の要素に 'dragging' クラスがあれば削除
  if (currentPcDraggedElement && setlist.contains(currentPcDraggedElement)) {
    currentPcDraggedElement.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class for PC setlist item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }

  // モバイルのクローン要素があれば削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null; // クローン要素の参照をクリア

  // ドラッグ開始時の元のセットリストスロット (originalSetlistSlot) の状態を確実にリセット
  if (originalSetlistSlot) {
      originalSetlistSlot.classList.remove('placeholder-slot'); // プレースホルダー状態を解除
      // ⭐︎ ここを修正します：元のスロットの visibility を常に元に戻す ⭐︎
      originalSetlistSlot.style.visibility = ''; 
      
      console.log(`[finishDragging] Restored visibility and removed placeholder for originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex}.`);
      
      // 保存していた元のアイテムデータがあれば削除
      if (originalSetlistSlot._originalItemData) {
          delete originalSetlistSlot._originalItemData;
      }
  }

  // すべてのセットリストスロットからドラッグ関連のクラスを削除し、opacityをリセット
  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target'); 
    slot.style.opacity = '';
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // 全てのグローバルなドラッグ関連変数をリセット
  currentDropZone = null;
  activeTouchSlot = null;
  currentPcDraggedElement = null;
  draggingItemId = null; 
  isDragging = false;
  originalSetlistSlot = null; // 参照を完全にクリア

  // タイマーやアニメーションフレームのIDがあればクリア
  if (touchTimeout) { 
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) { 
      cancelAnimationFrame(rafId);
      rafId = null;
  }

  // セットリスト内のアイテムに基づいて、アルバムメニューの表示を更新
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
        finishDragging(); // <-- ここに追加
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
    finishDragging(); // <-- ここに追加
}


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