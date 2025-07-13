// グローバル変数
let draggedItem = null; // ドラッグ中の「元の」要素 (PC/Mobile共通、アルバム内のアイテムかセットリスト内のスロット)
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムIDを保持 (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0; // ダブルタップ判定用
let touchTimeout = null; // ロングプレス判定用タイマーのIDを保持
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap (PCドラッグからの復元用)
let originalSetlistSlot = null; // セットリスト内でドラッグ開始された「元のスロット要素」を指す

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton"); // menuButton はHTMLに存在しないようです。hamburgerMenu を使用します。
const albumList = document.querySelector(".album-list");
const maxSongs = 26; // 最大曲数

let currentDropZone = null; // 現在ドラッグオーバーしているドロップゾーン (PC/Mobile共通)
let rafId = null; // requestAnimationFrame のID

/*------------------------------------------------------------------------------------------------------------*/

// --- ヘルパー関数 ---

/**
 * アイテム（アルバム or セットリスト）からデータを抽出し、オブジェクトとして返すヘルパー関数。
 * @param {Element} element - データ抽出元の要素 (album .item, setlist-slot.setlist-item, or clone)
 * @returns {object|null} 曲のデータオブジェクト、またはnull
 */
function getSlotItemData(element) {
    if (!element || (!element.classList.contains('item') && !element.classList.contains('setlist-slot'))) {
        console.warn("[getSlotItemData] Provided element is not a recognizable item or slot. Returning null.", element);
        return null;
    }

    const isSetlistItemInSlot = element.classList.contains('setlist-item');
    
    let songName = element.dataset.songName || element.textContent.trim(); // 基本はdatasetから、なければtextContent
    let itemId = element.dataset.itemId;

    // オプション（Short/SE/ドラムソロ）は、スロット内のアイテムから取得する場合と、
    // アルバムアイテムやクローンから取得する場合で初期値が変わる
    let isCheckedShort = false;
    let isCheckedSe = false;
    let isCheckedDrumsolo = false;

    // オプションを持つかどうかは、アルバムアイテムのdatasetまたはセットリストアイテムのdatasetから取得
    const hasShortOption = element.dataset.isShortVersion === 'true';
    const hasSeOption = element.dataset.hasSeOption === 'true';
    const hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

    // セットリストスロット内のアイテムの場合のみ、チェックボックスの状態を反映
    if (isSetlistItemInSlot) {
        isCheckedShort = element.dataset.short === 'true';
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';
    }

    // アルバムクラスは、要素自体に付いているクラスから検索
    const albumClass = Array.from(element.classList).find(className => className.startsWith('album-'));

    // その他の詳細情報
    const rGt = element.dataset.rGt || '';
    const lGt = element.dataset.lGt || '';
    const bass = element.dataset.bass || '';
    const bpm = element.dataset.bpm || '';
    const chorus = element.dataset.chorus || '';

    // スロットインデックスは、セットリストスロットにのみ存在
    const slotIndex = element.dataset.slotIndex || null;

    return {
        name: songName,
        itemId: itemId,
        short: isCheckedShort,
        seChecked: isCheckedSe,
        drumsoloChecked: isCheckedDrumsolo,
        hasShortOption: hasShortOption,
        hasSeOption: hasSeOption,
        hasDrumsoloOption: hasDrumsoloOption,
        albumClass: albumClass,
        slotIndex: slotIndex,
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
 * @param {Element} slotToClear - クリアするスロット要素 (li.setlist-slot)
 */
function clearSlotContent(slotToClear) {
    if (!slotToClear || !slotToClear.classList.contains('setlist-slot')) {
        console.warn("[clearSlotContent] Provided element is not a valid setlist slot. Skipping.", slotToClear);
        return;
    }

    console.log(`[clearSlotContent] Clearing slot: ${slotToClear.dataset.slotIndex}`);

    // 子要素を全て削除
    slotToClear.innerHTML = '<span class="default-text">クリックして曲を追加</span>';
    
    // 関連するクラスを削除
    slotToClear.classList.remove(
        'setlist-item', 'item', 'short', 'se-active', 'drumsolo-active', 'placeholder-slot'
    );
    // album-XXX のクラスも削除
    Array.from(slotToClear.classList).forEach(cls => {
        if (cls.startsWith('album-')) {
            slotToClear.classList.remove(cls);
        }
    });

    // データ属性を削除
    const dataAttributesToRemove = [
        'item-id', 'song-name', 'is-short-version', 'has-se-option',
        'has-drumsolo-option', 'short', 'se-checked', 'drumsolo-checked',
        'r-gt', 'l-gt', 'bass', 'bpm', 'chorus'
    ];
    dataAttributesToRemove.forEach(attr => slotToClear.removeAttribute(`data-${attr}`));

    // インラインスタイルをリセット
    slotToClear.style.cssText = ''; 
    slotToClear.style.visibility = ''; 
    slotToClear.draggable = false; // ドラッグ不可に戻す
    
    // スロット自体に設定されたイベントリスナーを削除し、ドロップターゲットのイベントを再設定
    // これにより、setlist-itemとしてのイベントがクリーンアップされる
    enableDragAndDrop(slotToClear); 

    // 内部データもクリア
    if (slotToClear._originalItemData) {
        delete slotToClear._originalItemData;
    }

    console.log(`[clearSlotContent] Slot ${slotToClear.dataset.slotIndex} cleared successfully.`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * アイテムを元のアルバムリストに戻し、セットリストから削除する。
 * この関数は、主にセットリストからアイテムを削除する際に呼び出される。
 * @param {string} itemId - セットリストから戻す、または削除する対象のアイテムID
 * @param {boolean} fromSetlistOnly - trueの場合、セットリストからのアイテムのみを処理し、アルバムアイテムの表示は戻さない
 */
function restoreToOriginalList(itemId, fromSetlistOnly = false) {
    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID provided for restoration. Skipping.`);
        return;
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}. fromSetlistOnly: ${fromSetlistOnly}`);

    // アルバムメニュー内の対応するアイテムを表示状態に戻す
    if (!fromSetlistOnly) {
        const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (albumItemInMenu) {
            albumItemInMenu.style.visibility = ''; // 非表示スタイルを解除
            console.log(`[restoreToOriginalList] Original album item for ID ${itemId} is now visible in menu.`);
        } else {
            console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
        }
    } else {
        console.log(`[restoreToOriginalList] Skipped restoring album item ${itemId} because 'fromSetlistOnly' is true.`);
    }

    // セットリスト内のスロットをクリアする
    const slotToClearInSetlist = setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${itemId}"]`);
    if (slotToClearInSetlist) {
        console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotToClearInSetlist.dataset.slotIndex}`);
        clearSlotContent(slotToClearInSetlist); 
    } else {
        console.log(`[restoreToOriginalList] Item ${itemId} was not found in setlist, no setlist slot to clear.`);
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

  // フェードイン
  setTimeout(() => {
    messageBox.style.opacity = '1';
  }, 10);

  // フェードアウト
  setTimeout(() => {
    messageBox.style.opacity = '0';
    messageBox.addEventListener('transitionend', function handler() {
      messageBox.style.display = 'none';
      messageBox.removeEventListener('transitionend', handler);
    }, {once: true});
  }, 2000); // 2秒後に消え始める
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

    // まず全てのアルバムアイテムを表示状態にする (念のため)
    allAlbumItems.forEach(item => {
        item.style.visibility = ''; 
    });
    console.log("[hideSetlistItemsInMenu] All album items temporarily made visible.");

    const currentSetlistItemsInSlots = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    if (currentSetlistItemsInSlots.length === 0) {
        console.log("[hideSetlistItemsInMenu] Setlist is empty, no items to hide.");
        return;
    }

    currentSetlistItemsInSlots.forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItemInMenu) {
                albumItemInMenu.style.visibility = 'hidden'; // メニューから非表示
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
 * セットリストの内容を文字列配列として取得する。
 * @returns {string[]} セットリストの曲リストの整形された文字列配列
 */
function getSetlist() {
  const currentSetlist = Array.from(document.querySelectorAll("#setlist .setlist-slot"))
    .map((slot, index) => {
        // スロットがsetlist-itemクラスを持っていれば曲情報、そうでなければ空またはテキストスロット
        if (slot.classList.contains('setlist-item')) {
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

            // チューニング情報
            const tuningParts = [];
            if (songData.rGt) tuningParts.push(`A.Gt（${songData.rGt}）`);
            if (songData.lGt) tuningParts.push(`K.Gt（${songData.lGt}）`);
            if (songData.bass) tuningParts.push(`B（${songData.bass}）`);
            if (tuningParts.length > 0) {
                line += ` (${tuningParts.join(' ')})`;
            }

            if (songData.bpm) {
                line += ` (BPM:${songData.bpm})`;
            }
            if (songData.chorus) {
                line += ` (C:${songData.chorus})`;
            }
            return line;
        } else {
            // 空のスロットや、カスタムテキストスロットの場合
            const customText = slot.querySelector('.text-input-slot')?.value.trim();
            if (customText) {
                return `${index + 1}. ${customText} (カスタム)`;
            }
            return `${index + 1}. (空きスロット)`;
        }
    });
    console.log("[getSetlist] Current formatted setlist:", currentSetlist);
    return currentSetlist;
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * 現在のアプリケーションの状態をまとめて取得する。
 * @returns {object} アプリケーションの状態を含むオブジェクト
 */
function getCurrentState() {
  const setlistState = Array.from(setlist.children)
    .map(slot => {
      if (slot.classList.contains('setlist-item')) {
        return {
            type: 'song',
            data: getSlotItemData(slot)
        };
      } else {
        // 空のスロットやテキストスロットも保存対象に含める
        const customTextInput = slot.querySelector('.text-input-slot');
        if (customTextInput) {
            return {
                type: 'text',
                textContent: customTextInput.value.trim(),
                slotIndex: slot.dataset.slotIndex
            };
        }
        return {
            type: 'empty',
            slotIndex: slot.dataset.slotIndex
        };
      }
    });

  const menuOpen = menu.classList.contains('open');
  // アクティブなアルバムをIDで取得 (例: album-rock, album-pop)
  const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

  // Mapをプレーンなオブジェクトに変換して保存
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

  const setlistVenueInput = document.getElementById('setlistVenue');
  const setlistVenue = setlistVenueInput ? setlistVenueInput.value.trim() : '';

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

/**
 * ドラッグ&ドロップ、タッチイベントのリスナーを要素に設定する。
 * @param {Element} element - リスナーを設定する要素
 */
function enableDragAndDrop(element) {
    // 既存のイベントリスナーを削除 (二重登録防止)
    element.removeEventListener("dragstart", handleDragStart);
    element.removeEventListener("dragover", handleDragOver);
    element.removeEventListener("dragleave", handleDragLeave);
    element.removeEventListener("dragenter", handleDragEnter); // 追加
    element.removeEventListener("drop", handleDrop);
    
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchmove", handleTouchMove);
    element.removeEventListener("touchend", handleTouchEnd);
    element.removeEventListener("touchcancel", handleTouchCancel); // 追加
    element.removeEventListener("dblclick", handleDoubleClick);

    // ドラッグソース（アルバムの曲、セットリストの曲）の場合
    if (element.classList.contains('item') || element.classList.contains('setlist-item')) {
        // itemId がなければ生成 (主にカスタムテキストスロットを曲に変える場合など)
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) { // dataset.songNameがない場合、textContentから設定
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true; // PCドラッグを許可

        element.addEventListener("dragstart", handleDragStart);
        // passive: false は event.preventDefault() を使用するために必要
        element.addEventListener("touchstart", handleTouchStart, { passive: false }); 
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchCancel);
        element.addEventListener("dblclick", handleDoubleClick); 
        console.log(`[enableDragAndDrop] Drag source enabled for: ${element.dataset.itemId || element.className}`);
        
    } 
    // ドロップターゲット（セットリストのスロット）の場合
    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);

        // 空のスロットはダブルクリックでテキスト入力に切り替えられる
        // ただし、既にアイテムがあるスロットでは、アイテムに対するダブルクリックが優先されるため、
        // スロット自体のダブルクリックリスナーは「アイテムが無い場合のみ」設定する
        if (!element.classList.contains('setlist-item')) {
             element.addEventListener("dblclick", handleDoubleClick); 
             console.log(`[enableDragAndDrop] Empty setlist slot drop target and dblclick enabled for slot: ${element.dataset.slotIndex}`);
        } else {
            console.log(`[enableDragAndDrop] Setlist slot with item drop target enabled for slot: ${element.dataset.slotIndex}`);
        }
    }
}

// グローバルな dragend リスナー (どの要素のドラッグが終了してもクリーンアップするため)
document.addEventListener("dragend", finishDragging);


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ開始時の処理 (PC用)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  const originalElement = event.target.closest(".item") || event.target.closest(".setlist-item");
  if (!originalElement || !originalElement.dataset.itemId) {
    console.warn("[dragstart:PC] No draggable item found or missing itemId. Preventing default.");
    event.preventDefault();
    return;
  }

  // ドラッグ中のアイテムが、アルバム内の隠されているアイテムではないことを確認 (二重ドラッグ防止)
  if (originalElement.style.visibility === 'hidden') {
      console.warn("[dragstart:PC] Attempted to drag a hidden album item. Preventing default.");
      event.preventDefault();
      return;
  }

  // グローバル変数をリセット
  finishDragging(); // 新しいドラッグが始まる前に古い状態をクリーンアップ
  
  draggingItemId = originalElement.dataset.itemId;
  draggedItem = originalElement; // draggedItem は元の要素を指す

  event.dataTransfer.setData("text/plain", draggingItemId);
  event.dataTransfer.effectAllowed = "move";

  if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
    originalSetlistSlot = originalElement;
    originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);

    // 元のスロットを視覚的に隠し、ポインターイベントを無効にする
    originalSetlistSlot.style.opacity = '0'; 
    originalSetlistSlot.style.pointerEvents = 'none'; 
    originalSetlistSlot.classList.add('placeholder-slot'); // レイアウトを維持するためのクラス

    console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);

  } else {
    // アルバムからのドラッグ
    originalSetlistSlot = null; 
    console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the draggedItem.`);
  }

  // originalAlbumMapに元のアルバムIDを保存 (PCドラッグからの復元用)
  if (!originalAlbumMap.has(draggingItemId)) {
    const originalList = originalElement.closest('.album-content'); // 親のアルバムIDを取得
    const originalListId = originalList ? originalList.id : null;
    originalAlbumMap.set(draggingItemId, originalListId);
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set for album item)`);
  } else {
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known in map)`);
  }
  
  // ドラッグ中に半透明にするクラスを追加 (PCドラッグでは event.target に直接追加)
  draggedItem.classList.add("dragging");
  console.log(`[dragstart] Initialized PC drag for: ${draggingItemId}`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ要素がドロップターゲットに入った時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragEnter(event) {
  event.preventDefault(); 
  const targetSlot = event.target.closest('.setlist-slot');
  
  if (targetSlot) {
    // ドラッグ中のアイテムとターゲットが同じスロットでないことを確認 (自身の上に戻る場合はハイライトしない)
    if (originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
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
  event.preventDefault(); // これがないとdropイベントが発生しない

  // データ転送効果を設定 (移動)
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  // draggingItemId が設定されていない場合は無効なドラッグと判断
  if (!draggingItemId) {
      console.warn("[dragover] No draggingItemId set. Preventing drop effect.");
      return;
  }

  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot; // 新しいドロップゾーン候補

  if (newDropZone) {
    // 元のスロットの上にドラッグバックされた場合、ハイライトしない
    if (originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
      if (currentDropZone) { // 以前のハイライトがあれば解除
        currentDropZone.classList.remove('drag-over');
      }
      currentDropZone = null; // 現在のドロップゾーンをクリア
      return;
    }

    // 新しいドロップゾーンが以前のドロップゾーンと異なる場合
    if (newDropZone !== currentDropZone) {
      if (currentDropZone) { // 以前のドロップゾーンのハイライトを解除
        currentDropZone.classList.remove('drag-over');
      }
      newDropZone.classList.add('drag-over'); // 新しいドロップゾーンをハイライト
      currentDropZone = newDropZone; // 現在のドロップゾーンを更新
      console.log(`[dragover] Highlighting new drop zone: ${newDropZone.dataset.slotIndex}`);
    }
  } else if (currentDropZone) {
    // ドロップターゲットとなるスロット外にドラッグされた場合
    currentDropZone.classList.remove('drag-over'); // 以前のハイライトを解除
    currentDropZone = null; // 現在のドロップゾーンをクリア
    console.log("[dragover] Left all drop zones.");
  }
}

// ... (第1部のコードに続く) ...

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ処理ロジックの中心。
 * @param {Element} actualDraggedElement - 実際にドラッグされた元の要素 (PC) またはクローン要素 (Mobile)
 * @param {Element|null} dropTargetSlot - ドロップされたターゲットスロット要素、またはnull
 * @param {Element|null} initialOriginalSetlistSlot - セットリストからドラッグされた場合の元のスロット要素 (PC/Mobile共通)
 */
function processDrop(actualDraggedElement, dropTargetSlot, initialOriginalSetlistSlot = null) {
    console.log("[processDrop] Initiated. actualDraggedElement:", actualDraggedElement, "dropTargetSlot:", dropTargetSlot, "initialOriginalSetlistSlot:", initialOriginalSetlistSlot);

    const itemId = actualDraggedElement.dataset.itemId;
    if (!itemId) {
        console.error("[processDrop] actualDraggedElement has no itemId. Aborting processDrop.");
        // もしクローン要素が残っていたら削除 (念のため)
        if (actualDraggedElement === currentTouchDraggedClone && actualDraggedElement.parentNode === document.body) {
            actualDraggedElement.remove();
        }
        return;
    }

    // ドラッグされたアイテムのデータを取得（_originalItemDataがあればそれを使う）
    const draggedItemData = initialOriginalSetlistSlot && initialOriginalSetlistSlot._originalItemData
                            ? initialOriginalSetlistSlot._originalItemData
                            : getSlotItemData(actualDraggedElement);

    if (!draggedItemData) {
        console.error("[processDrop] Failed to get item data for dragged element. Aborting processDrop.");
        return;
    }
    console.log("[processDrop] draggedItemData:", draggedItemData);

    const isDraggedFromSetlist = initialOriginalSetlistSlot !== null;
    console.log("[processDrop] isDraggedFromSetlist:", isDraggedFromSetlist);

    if (dropTargetSlot) {
        // ドロップ先が元のスロットと同じ場合は、何もしないで元の状態に戻す
        if (isDraggedFromSetlist && dropTargetSlot.dataset.slotIndex === initialOriginalSetlistSlot.dataset.slotIndex) {
            console.log("[processDrop] Dropped back to original slot. No change needed beyond cleanup.");
            // finishDragging が元のスロットの表示を戻すので、ここでは何もしない
            return;
        }

        if (isDraggedFromSetlist) {
            // セットリスト内での移動（スワップまたは空きスロットへの移動）
            if (dropTargetSlot.classList.contains('setlist-item')) {
                // スワップ処理
                console.log(`[processDrop] Swapping items. Original slot: ${initialOriginalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                const targetSlotItemData = getSlotItemData(dropTargetSlot);
                if (targetSlotItemData) {
                    fillSlotWithItem(initialOriginalSetlistSlot, targetSlotItemData); // 元のスロットにターゲットのアイテムを入れる
                }
                fillSlotWithItem(dropTargetSlot, draggedItemData); // ターゲットスロットにドラッグされたアイテムを入れる
            } else {
                // セットリスト内のアイテムを空のスロットに移動
                console.log(`[processDrop] Moving item within setlist to empty slot. Original slot: ${initialOriginalSetlistSlot.dataset.slotIndex}, Target slot: ${dropTargetSlot.dataset.slotIndex}`);
                clearSlotContent(initialOriginalSetlistSlot); // 元のスロットをクリア
                fillSlotWithItem(dropTargetSlot, draggedItemData); // ターゲットスロットにドラッグされたアイテムを入れる
            }
        } else {
            // アルバムからのドロップ
            if (dropTargetSlot.classList.contains('setlist-item')) {
                showMessageBox('このスロットはすでに埋まっています。');
                // アルバムアイテムを元に戻す処理は finishDragging が行うため、ここでは `return` のみ
                return; 
            }

            const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
            if (currentSongCount >= maxSongs) {
                showMessageBox('セットリストは最大曲数に達しています。');
                // アルバムアイテムを元に戻す処理は finishDragging が行うため、ここでは `return` のみ
                return;
            }

            console.log(`[processDrop] Adding item from album. Target slot: ${dropTargetSlot.dataset.slotIndex}`);
            fillSlotWithItem(dropTargetSlot, draggedItemData);
            // アルバムリスト内の元のアイテムは finishDragging で非表示になるので、ここでは何もしない
        }
    } else {
        // ドロップターゲットがない（セットリスト外にドロップされた）
        console.log("[processDrop] Dropped outside setlist.");
        if (isDraggedFromSetlist) {
            // セットリストからドラッグされたアイテムを、セットリストから削除
            console.log(`[processDrop] Item from setlist (${itemId}) dropped outside. Clearing original slot.`);
            restoreToOriginalList(itemId, true); // アルバムアイテムは表示しない (セットリストからアルバムに戻る場合)
        } else {
            // アルバムからドラッグされたアイテムを、元のアルバムリストに戻す
            console.log(`[processDrop] Album item (${itemId}) dropped outside. Restoring to original list.`);
            // この場合、アルバムアイテムは既に finishDragging で表示状態に戻るので、ここでは何もしない
            // ロジックを簡素化するため、restoreToOriginalList を呼ばない
        }
    }
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドロップ時の処理 (PC/モバイル共通エントリポイント)。
 * @param {Event} event - ドロップイベント (DragEvent or TouchEvent)
 */
function handleDrop(event) {
  event.preventDefault(); // ドロップのデフォルト動作を防ぐ
  console.log("[handleDrop] Drop event fired.");
  
  // draggingItemId は handleDragStart または handleTouchStart で既に設定済み
  if (!draggingItemId) {
    console.error("[handleDrop] No draggingItemId found. Aborting drop.");
    finishDragging();
    return;
  }

  // draggedItem は handleDragStart または createTouchDraggedClone で既に設定済み
  if (!draggedItem) {
    console.error("[handleDrop] draggedItem is null. This should not happen.");
    finishDragging(); 
    return;
  }
  console.log("[handleDrop] draggedItem (global):", draggedItem);

  let dropTargetSlot = null;
  // PCドラッグの場合
  if (event instanceof DragEvent) {
    dropTargetSlot = event.target.closest('.setlist-slot');
  } 
  // モバイルタッチの場合 (handleTouchEndで既に要素が特定されているため、ここでは確認のみ)
  else if (event.changedTouches && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
  }
  
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

  // processDrop関数にロジックを委譲
  // originalSetlistSlot はグローバル変数として既に設定済み
  processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
  
  finishDragging(); // ドラッグ終了後のクリーンアップ処理
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
        lastTapTime = 0; // ダブルタップ検出をリセット
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // isDragging は既に false のはずだが念のため
        return; // チェックボックスの動作を妨げないため、ここでは event.preventDefault() を呼ばない
    }

    const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
    if (!touchedElement) {
        console.log("[touchstart:Mobile] Touched element is not a draggable item. Allowing default behavior.");
        return; // ドラッグ可能な要素でなければ、スクロールを妨げない
    }

    console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedElement);
    console.log("[touchstart:Mobile] Touched element itemId:", touchedElement.dataset.itemId);

    // ダブルタップ検出ロジック
    if (tapLength < 300 && tapLength > 0) {
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        handleDoubleClick(event); // ダブルタップとして処理
        lastTapTime = 0;
        isDragging = false; // ドラッグ状態もリセット

        // ダブルタップ時はデフォルトのスクロールなどを防ぐ (ユーザーがタップと認識するため)
        event.preventDefault(); 
        console.log("[touchstart:Mobile] Double tap detected. Handled by handleDoubleClick. Default prevented.");
        return;
    }
    lastTapTime = currentTime;

    if (event.touches.length === 1) {
        // ドラッグ状態をリセットし、ドラッグが開始されるまでスクロールを許可
        isDragging = false; 
        draggingItemId = touchedElement.dataset.itemId; // ドラッグ開始候補のアイテムIDを保持
        draggedItem = touchedElement; // グローバル draggedItem に元の要素を一時的に設定

        if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement; // セットリストからのドラッグの場合、元のスロットを保持
            originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot); // 元のデータを保存
            console.log(`[touchstart:Mobile] Setlist item touched: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
        } else {
            originalSetlistSlot = null; // アルバムアイテムからのドラッグ
            console.log(`[touchstart:Mobile] Album item touched: ${touchedElement.dataset.itemId}`);
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;

        // 既存のタイムアウトがあればクリア
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }

        // ロングプレス判定用のタイマーを設定
        touchTimeout = setTimeout(() => {
            // ロングプレスが確定し、ドラッグを開始する
            // ここで初めて event.preventDefault() を呼び出すことで、
            // ロングプレスが確定するまではスクロールを許可する
            if (draggingItemId && draggedItem && document.body.contains(draggedItem)) {
                event.preventDefault(); // ドラッグ開始が確定したため、デフォルト動作をキャンセル
                createTouchDraggedClone(draggedItem, touchStartX, touchStartY, draggingItemId);
                isDragging = true; // ドラッグ中フラグを立てる
                console.log("[touchstart:Mobile] Dragging initiated after timeout. event.preventDefault() called.");
            } else {
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout (draggedItem missing or draggingItemId null).");
            }
            touchTimeout = null; // タイムアウトが発火したらクリア
        }, 600); // 600ミリ秒のロングプレスでドラッグ開始
    }
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチ移動時の処理
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
    // ドラッグが開始されていない場合は何もしないが、ロングプレス判定中はスクロールを許可
    if (!isDragging || !currentTouchDraggedClone) {
        // ドラッグ開始前の短い動きはスクロールとして許可するため、ここで preventDefault は呼ばない
        return;
    }

    // ドラッグが開始された後は常にデフォルトのスクロールをキャンセル
    event.preventDefault(); 
    // console.log("[handleTouchMove] Dragging active, preventing default."); // ログが多すぎる可能性があるのでコメントアウト

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        if (!currentTouchDraggedClone) {
            rafId = null;
            return;
        }
        const touch = event.touches[0];
        if (!touch) {
            rafId = null;
            return;
        }
        const newX = touch.clientX;
        const newY = touch.clientY;

        const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
        currentTouchDraggedClone.style.left = (newX - cloneRect.width / 2) + 'px';
        currentTouchDraggedClone.style.top = (newY - cloneRect.height / 2) + 'px';

        const targetElement = document.elementFromPoint(newX, newY);
        const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

        // 元のスロットの上にドラッグバックされた場合、ハイライトしない
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
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
    // 短いタップの場合 (ロングプレスのタイムアウトが発火していない場合)
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] Touch was a tap/short press. Clearing timeout and returning without drop processing.");
        // finishDragging() は handleDrop や handleDoubleClick など他の場所で呼ばれるため、
        // ドラッグが開始されなかった場合はここで呼ばない。isDragging は既に false のはず。
        return;
    }

    // ドラッグ操作が行われていない場合は、ここで処理を終了
    if (!isDragging) {
        console.log("[touchend] Not in dragging state. Skipping drop processing.");
        // isDragging が false であれば finishDragging() も不要
        return; 
    }
    
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging(); // クリーンアップのみ実行
        return;
    }

    // ドロップターゲットの特定
    let dropTargetSlot = null;
    const touch = event.changedTouches[0];
    if (touch) {
        const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
        dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    }
    
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (outside setlist)");

    // `processDrop` に処理を委譲
    // ここで `currentTouchDraggedClone` を `actualDraggedElement` として渡す
    // `originalSetlistSlot` はグローバル変数として設定済み
    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

    finishDragging(); // 全体的なクリーンアップ
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * タッチキャンセル時の処理
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchCancel(event) {
    console.log("[touchcancel] Touch operation cancelled.");
    // ロングプレス判定中のタイムアウトをクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
    // ドラッグ中の状態であればクリーンアップ
    if (isDragging) {
        finishDragging();
    }
    // スクロールなどのデフォルト動作を防ぐ
    event.preventDefault(); 
}

/*------------------------------------------------------------------------------------------------------------*/


/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 * @param {Element} originalElement - クローンを作成する元の要素 (アルバム内のアイテムまたはセットリストスロット)
 * @param {number} initialX - タッチ開始時のX座標
 * @param {number} initialY - タッチ開始時のY座標
 * @param {string} itemIdToClone - クローンに設定するアイテムID
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    // 既存のクローンがあれば削除
    if (currentTouchDraggedClone) {
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

    // クラスコピー (datasetコピーで大部分はカバーされるが、視覚的なクラスを確実にコピー)
    // album-XXX クラスもコピー
    Array.from(originalElement.classList).forEach(cls => {
        if (cls.startsWith('album-') || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active') {
            currentTouchDraggedClone.classList.add(cls);
        }
    });

    // dataset コピー
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; // 念のため再設定

    document.body.appendChild(currentTouchDraggedClone);

    // 元の要素を視覚的に隠す処理
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        // セットリスト内の元のスロットを隠す
        originalSetlistSlot = originalElement; // この場合、originalSetlistSlotは既に設定済みだが、念のため
        originalSetlistSlot._originalItemData = getSlotItemData(originalElement); // 元のデータを保存
        originalSetlistSlot.classList.add('placeholder-slot'); // レイアウトを維持
        originalSetlistSlot.style.opacity = '0'; // 透明にする
        originalSetlistSlot.style.pointerEvents = 'none'; // イベントを透過させる
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder, transparent, and pointer-events:none.`);
    } else {
        // アルバム内の元のアイテムを隠す
        originalElement.style.visibility = 'hidden'; 
        originalSetlistSlot = null; // アルバムアイテムからのドラッグの場合、元のスロットは存在しない
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // originalAlbumMapに元のアルバムIDを保存 (PCドラッグからの復元用)
    // touchstart で既に設定済みだが、ここでも念のため確認
    if (!originalAlbumMap.has(itemIdToClone)) {
        const originalList = originalElement.closest('.album-content'); 
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId);
        console.log(`[createTouchDraggedClone] itemId: ${itemIdToClone}, originalListId: ${originalListId} (newly set for touch drag)`);
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

    console.log(`[createTouchDraggedClone] Clone created for itemId=${itemIdToClone}`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ終了時のクリーンアップ処理。PC/モバイル共通。
 * ドロップが成功したか失敗したかにかかわらず、ドラッグ関連の状態をリセットする。
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // draggedItem に "dragging" クラスがついていれば削除
  // draggedItem は PCドラッグの元の要素か、タッチドラッグの元の要素を指す
  if (draggedItem) {
    draggedItem.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class from draggedItem: ${draggedItem.dataset.itemId || 'N/A'}`);
  }

  // モバイルドラッグのクローン要素を削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null; // クローンをリセット

  // originalSetlistSlot がプレースホルダー状態であれば、一時的なスタイルを解除し、元の表示に戻す
  if (originalSetlistSlot) {
      originalSetlistSlot.classList.remove('placeholder-slot');
      originalSetlistSlot.style.opacity = ''; // 透明度を元に戻す
      originalSetlistSlot.style.pointerEvents = ''; // ポインターイベントを元に戻す
      originalSetlistSlot.style.visibility = ''; // visibilityも元に戻す（PCドラッグの場合）

      if (originalSetlistSlot._originalItemData) {
          delete originalSetlistSlot._originalItemData; // 保存していたデータをクリア
      }
      console.log(`[finishDragging] Restored originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex || 'N/A'}.`);
  }

  // ドロップゾーンのハイライトをすべて解除
  setlist.querySelectorAll('.setlist-slot.drag-over')
    .forEach(slot => {
        slot.classList.remove('drag-over');
    });
  console.log("[finishDragging] Removed drag-over class from all setlist slots.");

  // グローバル変数をリセット
  currentDropZone = null;
  // activeTouchSlot は現在使われていないか、より新しい変数名 (currentDropZone) に置き換えられている可能性あり
  // activeTouchSlot = null; 
  draggedItem = null; // グローバル draggedItem をリセット
  draggingItemId = null; 
  isDragging = false; 
  originalSetlistSlot = null; 

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
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * ダブルクリック（ダブルタップ）時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDoubleClick(event) {
  const item = event.target.closest(".item") || event.target.closest(".setlist-slot"); // setlist-slot もターゲットになりうる
  if (!item) {
    console.log("[handleDoubleClick] No item or setlist-slot found for double click.");
    finishDragging(); // 必要に応じてクリーンアップ
    return;
  }

  event.preventDefault(); // デフォルト動作を防ぐ
  event.stopPropagation(); // イベントのバブリングを停止
  console.log(`[handleDoubleClick] Double click on element: ${item.dataset.itemId || item.dataset.slotIndex || 'N/A'}`);

  const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');
  const isSetlistSlotOnly = setlist.contains(item) && !item.classList.contains('setlist-item'); // セットリストの空スロット

  if (isInsideSetlist) {
    console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
    // アイテムがセットリスト内にある場合、そのアイテムを削除
    restoreToOriginalList(item.dataset.itemId, true); // セットリストからアイテムを削除し、アルバムに戻す
  } else if (isSetlistSlotOnly) {
    // セットリストの空スロットをダブルクリックした場合
    console.log("[handleDoubleClick] Empty setlist slot double clicked. Allowing text input.");
    // `createTextInputSlot` 関数が第3部で定義されていることを想定
    // ここでは、デフォルトのテキストを置き換えるか、テキスト入力を有効にするロジックを呼び出す
    if (typeof createTextInputSlot === 'function') {
        createTextInputSlot(item);
    } else {
        console.warn("[handleDoubleClick] createTextInputSlot function not found. Cannot enable text input.");
        showMessageBox("テキスト入力機能は利用できません。");
    }
  }
  else {
    // アルバムリストのアイテムをダブルクリックした場合
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    
    // セットリストに既に同じアイテムがないか確認
    if (setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
        showMessageBox('この曲はすでにセットリストにあります。');
        finishDragging();
        return;
    }

    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
    
    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      finishDragging();
      return;
    }

    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
    if (currentSongCount >= maxSongs) {
        showMessageBox('セットリストは最大曲数に達しています。');
        finishDragging();
        return;
    }

    const itemData = getSlotItemData(item);
    if (itemData) {
        fillSlotWithItem(emptySlot, itemData);
        // originalAlbumMap に元のアルバムIDを保存
        const originalList = item.closest('.album-content');
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(item.dataset.itemId, originalListId); 
        console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalListId}`);
        
        // アルバムリストの元のアイテムを非表示にする
        item.style.visibility = 'hidden'; 
        console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
    } else {
      console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
    }
  }
  finishDragging(); // ダブルクリック操作後のクリーンアップ
}


/*------------------------------------------------------------------------------------------------------------*/

/**
 * ドラッグ＆ドロップおよびタッチイベントリスナーを要素に設定する関数。
 * @param {Element} element - イベントリスナーを設定する要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // 既存のイベントリスナーを削除 (二重登録防止)
    element.removeEventListener("dragstart", handleDragStart);
    element.removeEventListener("dragover", handleDragOver);
    element.removeEventListener("dragleave", handleDragLeave);
    element.removeEventListener("dragenter", handleDragEnter);
    element.removeEventListener("drop", handleDrop); // ドロップイベントはドロップターゲットにのみ
    
    element.removeEventListener("touchstart", handleTouchStart);
    element.removeEventListener("touchmove", handleTouchMove);
    element.removeEventListener("touchend", handleTouchEnd);
    element.removeEventListener("touchcancel", handleTouchCancel); // touchcancelも追加
    element.removeEventListener("dblclick", handleDoubleClick);

    // ドラッグソース（アルバムの曲、セットリストの曲）の場合
    if (element.classList.contains('item') || element.classList.contains('setlist-item')) {
        // itemId がなければ生成 (主にカスタムテキストスロットを曲に変える場合など)
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) { // dataset.songNameがない場合、textContentから設定
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true; // PCドラッグを許可

        element.addEventListener("dragstart", handleDragStart);
        // passive: false は event.preventDefault() を使用するために必要
        element.addEventListener("touchstart", handleTouchStart, { passive: false }); 
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchCancel);
        element.addEventListener("dblclick", handleDoubleClick); 
        console.log(`[enableDragAndDrop] Drag source enabled for: ${element.dataset.itemId || element.className}`);
        
    } 
    // ドロップターゲット（セットリストのスロット）の場合
    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);

        // 空のスロットはダブルクリックでテキスト入力に切り替えられる
        // ただし、既にアイテムがあるスロットでは、アイテムに対するダブルクリックが優先されるため、
        // スロット自体のダブルクリックリスナーは「アイテムが無い場合のみ」設定する
        if (!element.classList.contains('setlist-item')) {
             element.addEventListener("dblclick", handleDoubleClick); 
             console.log(`[enableDragAndDrop] Empty setlist slot drop target and dblclick enabled for slot: ${element.dataset.slotIndex}`);
        } else {
            console.log(`[enableDragAndDrop] Setlist slot with item drop target enabled for slot: ${element.dataset.slotIndex}`);
        }
    }
}

// Global dragend listener (どの要素のドラッグが終了してもクリーンアップするため)
document.addEventListener("dragend", finishDragging);


/*------------------------------------------------------------------------------------------------------------*/


// --- UI操作関数と状態管理 ---

/**
 * メニューの開閉を切り替える。
 */
function toggleMenu() {
  menu.classList.toggle("open");
  // menuButton は存在しないため、hamburgerMenu に置き換える
  const hamburgerMenu = document.getElementById("hamburgerMenu"); // HTMLでのIDに合わせて変更
  if (hamburgerMenu) {
      hamburgerMenu.classList.toggle("open");
  } else {
      console.warn("[toggleMenu] hamburgerMenu element not found. Cannot toggle its class.");
  }
  console.log(`[toggleMenu] Menu is now: ${menu.classList.contains('open') ? 'open' : 'closed'}`);
}

/*------------------------------------------------------------------------------------------------------------*/

/**
 * アルバムの表示を切り替える。
 * @param {number} albumIndex - 切り替えるアルバムのインデックス
 */
function toggleAlbum(albumIndex) {
  document.querySelectorAll(".album-content").forEach(content => {
    // "album-1", "album-2" のようなIDを想定
    if (content.id === `album-${albumIndex}`) { 
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
  // Firebaseの初期化チェックをより堅牢に
  if (typeof firebase === 'undefined' || !firebase.database || !firebase.database()) {
    showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
    console.error('Firebase is not initialized or firebase.database is not available.');
    return;
  }

  // database オブジェクトがどこかで定義されていることを前提とする
  // 例: const database = firebase.database(); のように初期化されている必要がある
  if (typeof database === 'undefined') {
      showMessageBox('Firebase Databaseへの参照が見つかりません。');
      console.error('Firebase database reference (global `database` variable) is not defined.');
      return;
  }

  const currentState = getCurrentState(); // 日付と会場がここに含まれる
  const setlistRef = database.ref('setlists').push();

  setlistRef.set(currentState)
    .then(() => {
        const shareId = setlistRef.key;
        // 環境に合わせた正確なパスを構築
        const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

        // album1ItemIds はどこかで定義されているべき
        // ここではサンプルデータとして仮定義
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
            songListText = currentState.setlist.map(itemState => { // itemData -> itemState に変更
                if (itemState.type === 'text') {
                    // カスタムテキストスロット
                    return `${itemNo++}. ${itemState.textContent} (カスタム)`; 
                } else if (itemState.type === 'song') {
                    // 曲スロット
                    const itemData = itemState.data;
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
                    }
                    return line;
                } else {
                    // 空のスロット
                    return `${itemNo++}. (空きスロット)`;
                }
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
                if (error.name !== 'AbortError') { // ユーザーがキャンセルした場合のエラーは表示しない
                    showMessageBox('共有に失敗しました。');
                }
            });
        } else {
            // Web Share API 非対応ブラウザ向け
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

// ... (第1部、第2部のコードに続く) ...

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
    let simpleItemNo = 1; // シンプルPDFの連番用（カスタムテキストスロットも含む）

    // album1として扱うdata-item-idのリスト
    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

    // getCurrentState() を呼び出し、現在のセットリストの状態を取得
    const currentState = getCurrentState();
    const currentSetlist = currentState.setlist;

    for (const itemState of currentSetlist) {
        if (itemState.type === 'song') {
            const songData = itemState.data;
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

            const isAlbum1 = songData.itemId && album1ItemIds.includes(songData.itemId);

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
                simplePdfBody.push(`${simpleItemNo}. ${titleText}`);
                simpleItemNo++; 
            }
        } else if (itemState.type === 'text') {
            const textContent = itemState.textContent.trim();
            if (textContent) {
                // 詳細PDF用の行 (テキストスロットはNo.なし、タイトル列に全文)
                tableBody.push([textContent, '', '', '', '', '', '']); 
                // シンプルPDF用の行 (テキストスロットはNo.なし、連番を振らずに追加)
                simplePdfBody.push(`${simpleItemNo}. ${textContent} (カスタム)`); // カスタムテキストも連番を振る
                simpleItemNo++; 
            }
        } else {
            // 空のスロットはPDFに表示しない、またはPlaceholderとして表示することも可能
            // ここではシンプルPDFにも詳細PDFにも追加しない
            console.log(`[generateSetlistPdf] Skipping empty slot at index ${itemState.slotIndex} for PDF generation.`);
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
            detailedPdf.setFont('NotoSansJP', 'bold'); // ヘッダーを太字に
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
            simpleYPos += simpleFontSize * 1.5; // ヘッダーと曲リストの間の余白を大幅に増やす
            simplePdf.setFontSize(simpleFontSize); // 曲リスト用に戻す
        }

        // 各曲目をテキストとして追加
        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 0.5; // 行の高さを調整

            // ページ下部に近づいたら新しいページを追加
            const bottomMarginThreshold = 25; // 下部マージン
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
      if (typeof firebase === 'undefined' || !firebase.database || !firebase.database()) {
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
            // 各スロット要素を取得してクリアする
            document.querySelectorAll("#setlist .setlist-slot").forEach(slot => {
                clearSlotContent(slot);
            });
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
                    // updateDays が DOMContentLoaded 内で定義されているため、ここで直接呼び出すのは避ける
                    // または updateDays をグローバル関数として定義する
                    // 最も安全なのは、日付要素にchangeイベントをトリガーすること
                    const event = new Event('change');
                    setlistMonth.dispatchEvent(event); // 月を変更して日を更新

                    setlistDay.value = dateParts[2];

                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found. Initializing to today.");
                // 日付が保存されていない、または要素がない場合は今日の日付を設定
                // ここで日付を設定し、updateDaysを呼び出すのは、URLにshareIdがない場合と同じロジックになる
                const today = new Date();
                if (setlistYear) setlistYear.value = today.getFullYear();
                if (setlistMonth) {
                    setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
                    const event = new Event('change');
                    setlistMonth.dispatchEvent(event); // 月を変更して日を更新
                }
                if (setlistDay) setlistDay.value = today.getDate().toString().padStart(2, '0');
            }
            // 会場の復元
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            // セットリストアイテムの復元
            state.setlist.forEach(itemState => { // itemData -> itemState に変更
                const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemState.slotIndex}"]`);
                if (!targetSlot) {
                    console.warn(`[loadSetlistState] Target slot not found for index: ${itemState.slotIndex}. Skipping item restoration.`);
                    return;
                }

                if (itemState.type === 'text') {
                    // テキストスロットの復元
                    createTextInputSlot(targetSlot); // テキスト入力モードにする
                    targetSlot.textContent = itemState.textContent; // テキストコンテンツを設定
                    // ここで input 要素に値を設定する必要がある
                    const inputElement = targetSlot.querySelector('input[type="text"]');
                    if (inputElement) {
                        inputElement.value = itemState.textContent;
                        console.log(`[loadSetlistState] Filled text slot ${itemState.slotIndex} with "${itemState.textContent}"`);
                    } else {
                        console.warn(`[loadSetlistState] Text input element not found for slot ${itemState.slotIndex}.`);
                    }
                } else if (itemState.type === 'song') {
                    // 曲アイテムの復元
                    const itemData = itemState.data;
                    console.log(`[loadSetlistState] Filling slot ${itemState.slotIndex} with song ID: ${itemData.itemId}`);
                    fillSlotWithItem(targetSlot, itemData);

                    // オプションの状態を復元 (fillSlotWithItemでData-属性がセットされるが、クラスもセットする)
                    if (itemData.short) {
                        targetSlot.classList.add('short');
                    }
                    if (itemData.seChecked) {
                        targetSlot.classList.add('se-active');
                    }
                    if (itemData.drumsoloChecked) {
                        targetSlot.classList.add('drumsolo-active');
                    }

                    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
                    if (albumItemInMenu) {
                        albumItemInMenu.style.visibility = 'hidden';
                        console.log(`[loadSetlistState] Hid album item in menu: ${itemData.itemId}`);
                    }
                } else {
                    console.warn(`[loadSetlistState] Unknown item type '${itemState.type}' for slot ${itemState.slotIndex}. Skipping.`);
                }
            });

            // メニューとアルバムの開閉状態を復元
            const hamburgerMenu = document.getElementById("hamburgerMenu");
            if (state.menuOpen) {
              menu.classList.add('open');
              if (hamburgerMenu) hamburgerMenu.classList.add('open');
            } else {
              menu.classList.remove('open');
              if (hamburgerMenu) hamburgerMenu.classList.remove('open');
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
      console.log("[loadSetlistState] No shareId found in URL. Initializing default date.");
      const setlistYear = document.getElementById('setlistYear');
      const setlistMonth = document.getElementById('setlistMonth');
      const setlistDay = document.getElementById('setlistDay');

      if (setlistYear && setlistMonth && setlistDay) {
          const today = new Date();
          setlistYear.value = today.getFullYear();
          setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
          // 月の変更イベントをディスパッチして、日のドロップダウンを更新
          const event = new Event('change');
          setlistMonth.dispatchEvent(event); 
          setlistDay.value = today.getDate().toString().padStart(2, '0');
          console.log(`[loadSetlistState] Initialized date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
      } else {
          console.warn("[loadSetlistState] Date select elements not found for default date initialization.");
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
    // updateDays 関数は DOMContentLoaded スコープ内でのみ使用
    // 必要に応じてイベントリスナー内で呼び出す

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
    });
    console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

    // 共有IDがあればセットリストをロード
    // `updateDays` が `loadSetlistState` 内で呼び出されるように調整したので、
    // ここで日付を初期化する必要はない。`loadSetlistState` がデフォルトで今日の日付を設定する。
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
            const hamburgerMenu = document.getElementById("hamburgerMenu");
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