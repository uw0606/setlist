let draggingItem = null;
let draggingItemId = null; // ドラッグ中のアイテムIDを保持
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26; // 最大曲数を26に変更 (スロット数と一致)

let currentDropZone = null; // 現在ハイライトされているドロップゾーン
let activeTouchSlot = null; // タッチドラッグ時にアクティブなスロット


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} list - 有効にするリストの要素
 */
function enableDragAndDrop(list) {
  // アルバムリストのアイテムには通常のドラッグイベントを設定
  if (list !== setlist) {
    list.querySelectorAll(".item").forEach(item => {
      // データセットの初期化 (DOMContentLoaded で行われるため、ここでは重複防止)
      if (!item.dataset.itemId) {
        item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      }
      if (!item.dataset.songName) {
        item.dataset.songName = item.textContent.trim();
      }
      item.draggable = true; // ドラッグ可能にする

      // PC向けドラッグイベント
      item.addEventListener("dragstart", handleDragStart);
      item.addEventListener("dragend", finishDragging);

      // モバイル向けタッチイベント
      item.addEventListener("touchstart", handleTouchStart, { passive: false });
      item.addEventListener("touchmove", handleTouchMove, { passive: false });
      item.addEventListener("touchend", handleTouchEnd);
      item.addEventListener("touchcancel", handleTouchEnd); // タッチキャンセル時も終了
    });
  }

  // セットリストのスロットにはドロップイベントと、曲が入った場合のドラッグイベントを設定
  list.querySelectorAll(".setlist-slot").forEach(slot => {
    // ドロップイベント
    slot.addEventListener("dragover", handleDragOver);
    slot.addEventListener("drop", handleDrop);
    slot.addEventListener("dragenter", handleDragEnter);
    slot.addEventListener("dragleave", handleDragLeave);

    // スロットがセットリストアイテムとして機能する場合のタッチイベント
    // 初期化時（DOMContentLoaded）に .setlist-item が付与される可能性があるため、ここでイベントを設定
    // setlist-item は .item と同じスタイルとドラッグ可能特性を持つ
    if (slot.classList.contains('setlist-item')) {
      slot.draggable = true; // 曲が入っているスロットはドラッグ可能にする
      slot.addEventListener("dragstart", handleDragStart);
      slot.addEventListener("dragend", finishDragging);
      slot.addEventListener("touchstart", handleTouchStart, { passive: false });
      slot.addEventListener("touchmove", handleTouchMove, { passive: false });
      slot.addEventListener("touchend", handleTouchEnd);
      slot.addEventListener("touchcancel", handleTouchEnd);
    }
  });
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  const draggedElement = event.target.closest(".item") || event.target.closest(".setlist-item");
  if (draggedElement) {
    draggingItem = draggedElement;
    draggingItemId = draggedElement.dataset.itemId;

    if (!originalAlbumMap.has(draggingItemId)) {
      const originalList = draggedElement.parentNode;
      const originalListId = originalList ? originalList.id : null;
      originalAlbumMap.set(draggingItemId, originalListId);
      console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
    } else {
      console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
    }

    draggingItem.classList.add("dragging");
    event.dataTransfer.setData("text/plain", draggingItemId); // itemId をデータとして渡す
    event.dataTransfer.effectAllowed = "move";
    console.log(`[dragstart] dataTransfer set with: ${draggingItemId}`);
    console.log(`[dragstart] draggingItem element:`, draggingItem);
  } else {
    console.warn("[dragstart] No draggable item found.");
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ進入時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragEnter(event) {
  event.preventDefault();
  const targetSlot = event.target.closest('.setlist-slot');
  if (targetSlot) {
    if (targetSlot.classList.contains('setlist-item') && targetSlot === draggingItem) {
      // 自分自身の上に乗った場合はハイライトしない
      return;
    }
    if (activeTouchSlot) { // タッチドラッグ時の残りカスがあれば削除
      activeTouchSlot.classList.remove('drag-over');
    }
    if (currentDropZone) { // PCドラッグ時の残りカスがあれば削除
        currentDropZone.classList.remove('drag-over');
    }
    targetSlot.classList.add('drag-over');
    currentDropZone = targetSlot;
    console.log(`[dragenter] Target slot: ${targetSlot.dataset.slotIndex}, has item: ${targetSlot.classList.contains('setlist-item')}`);
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ退出時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
  const targetSlot = event.target.closest('.setlist-slot');
  if (targetSlot && targetSlot === currentDropZone) {
    // マウスがスロットから完全に離れたか、別のスロットに入った場合
    if (!targetSlot.contains(event.relatedTarget) || (event.relatedTarget && !event.relatedTarget.closest('.setlist-slot'))) {
      targetSlot.classList.remove('drag-over');
      currentDropZone = null;
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
  if (!draggingItem) return;

  const targetSlot = event.target.closest('.setlist-slot');
  if (targetSlot) {
    if (targetSlot.classList.contains('setlist-item') && targetSlot === draggingItem) {
      // 自分自身の上に乗った場合はハイライトしない
      if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
      }
      return;
    }
    if (targetSlot !== currentDropZone) {
      if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
      }
      targetSlot.classList.add('drag-over');
      currentDropZone = targetSlot;
    }
  } else if (currentDropZone) { // スロット外に移動した場合
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
  const draggedItem = document.querySelector(`[data-item-id="${droppedItemId}"]`); // アルバムリストかセットリストの曲

  if (!draggedItem) {
    console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". This usually means dataTransfer was empty or corrupted.");
    finishDragging(); // ここでクリーンアップを呼んでおく
    return;
  }
  console.log("[handleDrop] draggedItem found:", draggedItem);

  const dropTargetSlot = event.target.closest('.setlist-slot'); // ドロップされたスロット
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

  if (dropTargetSlot) {
    processDrop(draggedItem, dropTargetSlot);
  } else {
    // スロット以外にドロップされた場合、元の場所に戻す (主にセットリストから外にドラッグされた場合)
    console.warn("[handleDrop] Dropped outside a setlist slot. Attempting to restore to original list.");
    restoreToOriginalList(draggedItem);
  }
  finishDragging(); // ドロップ操作完了後に常にクリーンアップを保証
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ開始時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchStart(event) {
  // ダブルタップ検出 (約300ms以内)
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;
  if (tapLength < 300 && tapLength > 0) {
    event.preventDefault(); // ダブルタップズームなどを防ぐ
    handleDoubleClick(event); // ダブルクリック処理を呼び出す
    lastTapTime = 0; // リセット
    console.log("[touchstart] Double tap detected.");
    return;
  }
  lastTapTime = currentTime;

  if (event.touches.length === 1) { // シングルタッチのみを処理
    draggingItem = event.target.closest(".item") || event.target.closest(".setlist-item");
    if (draggingItem) {
      event.preventDefault(); // スクロールを防ぐ
      isDragging = false; // ドラッグ開始の可能性をリセット
      draggingItemId = draggingItem.dataset.itemId;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      console.log(`[touchstart] Possible drag start for item: ${draggingItemId}`);

      // 短い遅延後にドラッグ状態にする
      setTimeout(() => {
        if (!isDragging && draggingItem) { // まだドラッグが開始されていなければ
          isDragging = true;
          draggingItem.classList.add("dragging");
          console.log(`[touchstart] Dragging initiated after delay for item: ${draggingItemId}`);

          if (!originalAlbumMap.has(draggingItemId)) {
            const originalList = draggingItem.parentNode;
            const originalListId = originalList ? originalList.id : null;
            originalAlbumMap.set(draggingItemId, originalListId);
            console.log(`[touchstart] Original list for ${draggingItemId} set to: ${originalListId}`);
          }

          // ドラッグ中の要素を画面の一番手前に持ってくる
          draggingItem.style.position = 'fixed';
          draggingItem.style.zIndex = '1000';
          // 元の幅と高さを保持 (スロット/アイテムの現在の計算されたサイズ)
          const rect = draggingItem.getBoundingClientRect();
          draggingItem.style.width = rect.width + 'px';
          draggingItem.style.height = rect.height + 'px';
          // 初期位置を設定 (タッチ開始位置に合わせる)
          draggingItem.style.left = touchStartX - rect.width / 2 + 'px';
          draggingItem.style.top = touchStartY - rect.height / 2 + 'px';

          // 現在のスロットから一時的に内容をクリアして空のスロット状態にする
          if (draggingItem.parentNode.classList.contains('setlist-grid') && draggingItem.classList.contains('setlist-item')) {
            console.log(`[touchstart] Clearing content from original slot: ${draggingItem.dataset.slotIndex}`);
            clearSlotContent(draggingItem.parentNode, draggingItem.dataset.slotIndex);
          }

          // ドラッグ開始時にセットリスト内のすべてのスロットをドロップターゲットとして準備
          setlist.querySelectorAll('.setlist-slot').forEach(slot => {
            slot.classList.add('active-drop-target'); // ドロップターゲットとしてアクティブ化
          });
        }
      }, 100); // 100ms後にドラッグ開始とみなす
    }
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
  if (draggingItem && isDragging) {
    event.preventDefault(); // スクロールを防ぐ

    const touch = event.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    // ドラッグ中のアイテムをタッチ位置に追従させる
    draggingItem.style.left = clientX - draggingItem.offsetWidth / 2 + 'px';
    draggingItem.style.top = clientY - draggingItem.offsetHeight / 2 + 'px';

    // ドロップゾーンのハイライト処理
    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot && targetSlot !== activeTouchSlot) {
      if (activeTouchSlot) {
        activeTouchSlot.classList.remove('drag-over');
      }
      if (targetSlot !== draggingItem) { // 自分自身の上に乗った場合はハイライトしない
        targetSlot.classList.add('drag-over');
        activeTouchSlot = targetSlot;
      }
    } else if (!targetSlot && activeTouchSlot) {
      activeTouchSlot.classList.remove('drag-over');
      activeTouchSlot = null;
    }
  } else if (draggingItem && !isDragging) {
    // 少し動かしたらドラッグ開始とみなす
    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const dx = Math.abs(currentX - touchStartX);
    const dy = Math.abs(currentY - touchStartY);
    if (dx > 5 || dy > 5) { // 5px以上移動したらドラッグ開始
      isDragging = true;
      console.log(`[touchmove] Dragging started due to movement for item: ${draggingItemId}`);
      // 強制的にドラッグ状態にする
      draggingItem.classList.add("dragging");
      draggingItem.style.position = 'fixed';
      draggingItem.style.zIndex = '1000';
      const rect = draggingItem.getBoundingClientRect();
      draggingItem.style.width = rect.width + 'px';
      draggingItem.style.height = rect.height + 'px';
      draggingItem.style.left = currentX - rect.width / 2 + 'px';
      draggingItem.style.top = currentY - rect.height / 2 + 'px';

      if (!originalAlbumMap.has(draggingItemId)) {
        const originalList = draggingItem.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(draggingItemId, originalListId);
        console.log(`[touchmove] Original list for ${draggingItemId} set to: ${originalListId}`);
      }

      // 現在のスロットから一時的に内容をクリアして空のスロット状態にする
      if (draggingItem.parentNode.classList.contains('setlist-grid') && draggingItem.classList.contains('setlist-item')) {
        console.log(`[touchmove] Clearing content from original slot: ${draggingItem.dataset.slotIndex}`);
        clearSlotContent(draggingItem.parentNode, draggingItem.dataset.slotIndex);
      }

      setlist.querySelectorAll('.setlist-slot').forEach(slot => {
        slot.classList.add('active-drop-target');
      });
      event.preventDefault(); // スクロールを防ぐ
    }
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
  if (draggingItem) {
    // ドラッグ中のスタイルをリセット
    draggingItem.classList.remove("dragging");
    draggingItem.style.position = '';
    draggingItem.style.zIndex = '';
    draggingItem.style.width = '';
    draggingItem.style.height = '';
    draggingItem.style.left = '';
    draggingItem.style.top = '';
    console.log(`[touchend] Dragging styles reset for item: ${draggingItemId}`);

    setlist.querySelectorAll('.setlist-slot.active-drop-target').forEach(slot => {
      slot.classList.remove('active-drop-target');
    });

    if (isDragging) {
      event.preventDefault(); // タッチ終了時のクリックイベントを防ぐ

      // ドロップ処理
      const touch = event.changedTouches[0];
      const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
      const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
      console.log("[touchend] Drop target slot:", dropTargetSlot);

      processDrop(draggingItem, dropTargetSlot);
    } else {
      console.log("[touchend] Drag not initiated. Assuming tap/click.");
      // ドラッグが開始されなかった場合（単なるタップ）は、元のスロットに戻す
      // ここでは、セットリストのアイテムを"タップ"したときに、元のスロットに戻す挙動を期待するかどうか再検討が必要です。
      // 現状、ダブルタップで戻るので、ここでは何もしないのが適切かもしれません。
      if (draggingItem.parentNode === setlist && draggingItem.classList.contains('setlist-item')) {
          console.log("[touchend] Item was in setlist, but no drag. Double tap handles removal.");
          // タッチ開始時にスロットをクリアしているので、ドラッグが行われなかった場合は元に戻す
          const originalSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${draggingItem.dataset.slotIndex}"]`);
          if (originalSlot && !originalSlot.classList.contains('setlist-item')) { // スロットが空になっていたら
            fillSlotWithItem(originalSlot, { // draggingItem のデータをオブジェクト形式で渡す
              itemId: draggingItem.dataset.itemId,
              name: draggingItem.dataset.songName,
              albumClass: Array.from(draggingItem.classList).find(cls => cls.startsWith('album')),
              short: draggingItem.classList.contains('short')
            });
          }
      } else {
          console.log("[touchend] Item was from album, but no drag. Restore to album if not already there.");
          restoreToOriginalList(draggingItem);
      }
    }
  }
  finishDragging(); // 共通のドラッグ終了処理を呼び出す
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドロップ処理の共通関数。
 * @param {Element} draggedItem - ドラッグされたアイテム (アルバムのli.item または セットリストのli.setlist-slot.setlist-item)
 * @param {Element} dropTargetSlot - ドロップされたターゲットスロット (li.setlist-slot)
 */
function processDrop(draggedItem, dropTargetSlot) {
  console.log("[processDrop] Called with draggedItem:", draggedItem, "and dropTargetSlot:", dropTargetSlot);
  if (!draggedItem || !dropTargetSlot) {
    console.warn("[processDrop] Missing draggedItem or dropTargetSlot. Calling restoreToOriginalList.");
    restoreToOriginalList(draggedItem);
    return;
  }

  const targetSlotHasItem = dropTargetSlot.classList.contains('setlist-item');
  console.log(`[processDrop] dropTargetSlot (${dropTargetSlot.dataset.slotIndex}) has item: ${targetSlotHasItem}`);

  // ドラッグアイテムのデータをオブジェクト形式で準備
  const draggedItemData = {
    itemId: draggedItem.dataset.itemId,
    name: draggedItem.dataset.songName,
    albumClass: Array.from(draggedItem.classList).find(cls => cls.startsWith('album')),
    short: draggedItem.classList.contains('short') || (draggedItem.querySelector('input[type="checkbox"]') && draggedItem.querySelector('input[type="checkbox"]').checked),
    // ★ 追加: ドラッグ中のアイテムの isShortVersion も引き継ぐ
    isShortVersion: draggedItem.dataset.isShortVersion === 'true' // datasetから取得
  };

  // ドラッグ元がセットリスト内のスロットである場合 (再配置)
  if (draggedItem.parentNode === setlist && draggedItem.classList.contains('setlist-item')) {
    console.log("[processDrop] Drag source is setlist item (reordering).");
    const originalSlotIndex = draggedItem.dataset.slotIndex;
    const originalSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${originalSlotIndex}"]`);

    if (originalSlot === dropTargetSlot) {
      console.log("[processDrop] Dropped back into same slot. No change.");
      if (originalSlot) fillSlotWithItem(originalSlot, draggedItemData);
      return;
    }

    if (targetSlotHasItem) {
      console.log("[processDrop] Dropping onto occupied slot (swap scenario).");
      const tempItemDataToSwap = getSlotItemData(dropTargetSlot); // getSlotItemDataがisShortVersionを返す前提
      if (originalSlot && tempItemDataToSwap) {
        fillSlotWithItem(originalSlot, tempItemDataToSwap);
      } else if (!tempItemDataToSwap) {
        console.error("[processDrop] Failed to extract data for swap. Aborting swap.");
        fillSlotWithItem(originalSlot, draggedItemData);
        return;
      }
      fillSlotWithItem(dropTargetSlot, draggedItemData);
    } else {
      console.log("[processDrop] Dropping onto empty slot (move scenario).");
      fillSlotWithItem(dropTargetSlot, draggedItemData);
      clearSlotContent(setlist, originalSlotIndex);
    }
  } else {
    // ドラッグ元がアルバムリストである場合 (新規追加)
    console.log("[processDrop] Drag source is album list (new addition).");
    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
    console.log(`[processDrop] Current song count in setlist: ${currentSongCount}`);
    
    if (targetSlotHasItem) {
      console.log("[processDrop] Target slot is already occupied. Not adding album item.");
      showMessageBox('このスロットはすでに埋まっています。');
      restoreToOriginalList(draggedItem);
      return;
    }

    if (currentSongCount >= maxSongs) {
      console.log("[processDrop] Setlistは最大曲数に達しています。");
      showMessageBox('セットリストは最大曲数に達しています。');
      restoreToOriginalList(draggedItem);
      return;
    }

    console.log("[processDrop] Filling slot with item from album list.");
    fillSlotWithItem(dropTargetSlot, draggedItemData); // ここでdraggedItemDataをそのまま渡す

    const albumItem = document.querySelector(`.album-content .item[data-item-id="${draggedItem.dataset.itemId}"]`);
    if (albumItem) {
      console.log("[processDrop] Hiding original album item:", albumItem);
      albumItem.style.display = 'none';
    } else {
      console.warn("[processDrop] Original album item not found in menu for hiding:", draggedItem.dataset.itemId);
    }
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * スロット内のアイテムからデータを抽出し、オブジェクトとして返すヘルパー関数。
 * @param {Element} slotElement - データ抽出元のセットリストスロット要素 (li.setlist-slot)
 * @returns {object|null} 曲のデータオブジェクト、またはnull
 */
function getSlotItemData(slotElement) {
    if (!slotElement.classList.contains('setlist-item')) {
        console.warn("[getSlotItemData] Provided slotElement does not contain 'setlist-item' class. Returning null.");
        return null;
    }
    const itemInSlot = slotElement;

    const songInfo = itemInSlot.querySelector('.song-info');
    const songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : itemInSlot.dataset.songName;
    
    const checkbox = itemInSlot.querySelector('input[type="checkbox"]');
    const isCheckedShort = checkbox ? checkbox.checked : false; // 現在のチェック状態
    
    const albumClass = Array.from(itemInSlot.classList).find(className => className.startsWith('album'));
    const itemId = itemInSlot.dataset.itemId;

    // ★ 修正: スロット自身の dataset.isShortVersion を読み込む
    // fillSlotWithItem で設定される値がここで取得される
    const isShortVersion = slotElement.dataset.isShortVersion === 'true'; 

    return {
        name: songName,
        short: isCheckedShort,        // 現在のチェックボックスの状態 (Shortとして表示されているか)
        isShortVersion: isShortVersion, // ここで dataset から取得した値を返す
        albumClass: albumClass,
        itemId: itemId,
        slotIndex: slotElement.dataset.slotIndex
    };
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * セットリストのスロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 * 例: { itemId: "...", name: "曲名", albumClass: "...", short: true/false, isShortVersion: true/false }
 */
function fillSlotWithItem(slotElement, songData) {
  console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
  console.log(`[fillSlotWithItem]   songData received:`, songData);

  const songInfoContainer = slotElement.querySelector('.song-info-container');
  if (!songInfoContainer) {
    console.error("Missing .song-info-container div in slot:", slotElement);
    return;
  }
  songInfoContainer.innerHTML = '';

  const itemId = songData.itemId;
  const songName = songData.name;
  const albumClass = songData.albumClass;
  const isCurrentlyChecked = songData.short; // 現在のチェック状態

  // ★ 修正点: チェックボックスと (Short) ラベルを表示する条件を強化
  // songData.isShortVersion が true ならそれを最優先し、なければアルバムアイテムの short クラスを確認
  const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
  const isOriginalAlbumItemShort = originalAlbumItem ? originalAlbumItem.classList.contains('short') : false;

  // songData.isShortVersion があればそれを優先、なければ元のアルバムアイテムのクラスを見る
  const shouldShowShortOption = songData.isShortVersion === true || isOriginalAlbumItemShort; // songData.isShortVersion が undefined/null の場合も考慮

  const songInfoDiv = document.createElement('div');
  songInfoDiv.classList.add('song-info');

  const songNameTextNode = document.createTextNode(songName);
  songInfoDiv.appendChild(songNameTextNode);

  if (shouldShowShortOption) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyChecked;

    songInfoDiv.appendChild(checkbox);

    const label = document.createElement('span');
    label.textContent = '(Short)';
    songInfoDiv.appendChild(label);

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        slotElement.classList.toggle('short', e.target.checked);
        console.log(`[checkboxClick] Slot ${slotElement.dataset.slotIndex} short status changed to: ${e.target.checked}`);
    });
  }
  
  slotElement.classList.toggle('short', isCurrentlyChecked);
  
  songInfoContainer.appendChild(songInfoDiv);

  slotElement.classList.add('setlist-item', 'item');
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }
  
  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  // ★ ここが一番重要！ isShortVersion の状態をスロットのデータ属性に保存
  slotElement.dataset.isShortVersion = shouldShowShortOption ? 'true' : 'false';
  
  slotElement.draggable = true;
  slotElement.removeEventListener("dragstart", handleDragStart);
  slotElement.removeEventListener("dragend", finishDragging);
  slotElement.removeEventListener("touchstart", handleTouchStart);
  slotElement.removeEventListener("touchmove", handleTouchMove);
  slotElement.removeEventListener("touchend", handleTouchEnd);
  slotElement.removeEventListener("touchcancel", handleTouchEnd);

  slotElement.addEventListener("dragstart", handleDragStart);
  slotElement.addEventListener("dragend", finishDragging);
  slotElement.addEventListener("touchstart", handleTouchStart, { passive: false });
  slotElement.addEventListener("touchmove", handleTouchMove, { passive: false });
  slotElement.addEventListener("touchend", handleTouchEnd);
  slotElement.addEventListener("touchcancel", handleTouchEnd);
  console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and events re-attached.`);
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
            songInfoContainer.innerHTML = ''; // song-info-container の内容をクリア
        }
        
        slotToClear.classList.remove('setlist-item', 'item', 'short'); // クラスを削除
        // アルバムクラスも削除
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id'); // データ属性を削除
        slotToClear.removeAttribute('data-song-name');
        // slotToClear.removeAttribute('data-original-slot-index'); // originalSlotIndexはもう不要なので削除
        slotToClear.draggable = false; // 空のスロットはドラッグできないようにする
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ終了時の処理。
 */
function finishDragging() {
  const draggedItemEl = document.querySelector(`.item.dragging`); // draggingクラスが付いている要素を探す
  if (draggedItemEl) {
    draggedItemEl.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class from item: ${draggedItemEl.dataset.itemId || 'N/A'}`);
  }
  // 全てのスロットからハイライトとアクティブドロップターゲットクラスを削除
  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target');
  });
  currentDropZone = null;
  activeTouchSlot = null;
  draggingItem = null;
  draggingItemId = null;
  isDragging = false;
  console.log("[finishDragging] Drag operation finalized.");
}


/*------------------------------------------------------------------------------------------------------------*/


function restoreToOriginalList(item) {
  const itemId = item.dataset.itemId;
  console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}`);

  const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
  console.log(`[restoreToOriginalList] Found albumItemInMenu:`, albumItemInMenu); // ★ 追加
  if (albumItemInMenu) {
    albumItemInMenu.style.display = ''; // 表示に戻す
    console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
  } else {
    console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
  }

  // セットリストからアイテムが移動した場合、そのスロットをクリアする
  // itemがsetlist-itemクラスを持ち、かつ、setlistの子要素の場合にクリア
  if (item.parentNode === setlist && item.classList.contains('setlist-item')) {
      const slotIndex = item.dataset.slotIndex;
      console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotIndex}`);
      clearSlotContent(setlist, slotIndex);
  } else if (item.parentNode !== setlist && item.classList.contains('item')) {
      // draggingItem がアルバムリストのアイテムで、セットリストに入らずにドロップされた場合など
      // もしalbumItemInMenuが既に表示されているならそのまま
      if (albumItemInMenu && albumItemInMenu.style.display === 'none') {
          albumItemInMenu.style.display = ''; // 非表示になっていれば表示に戻す
          console.log(`[restoreToOriginalList] Album item was hidden, now visible: ${itemId}`);
      } else if (!albumItemInMenu) {
          // アルバムにもセットリストにも存在しない（おかしい状態）か、既にアルバムから削除されている場合
          console.log(`[restoreToOriginalList] Item ${itemId} not found in album or setlist parent. Removing it if still in DOM.`);
          item.remove(); // DOMから削除
      }
  }
  // originalAlbumMap.delete(itemId); // マップから削除 - ドラッグ＆ドロップ時にのみ行うのが安全
  console.log(`[restoreToOriginalList] originalAlbumMap NOT cleared here for ID: ${itemId} to maintain state for re-adds.`);
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
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

  const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

  if (isInsideSetlist) {
    console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
    // セットリスト内のアイテムをダブルクリックした場合
    // restoreToOriginalList が、該当 itemId のアルバムアイテムを再表示し、
    // セットリストのスロットをクリアするはず
    restoreToOriginalList(item);
  } else {
    // アルバムリストのアイテムをダブルクリックした場合 (セットリストに追加)
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
    
    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      return;
    }

    // セットリストに既に同じ曲がないかチェック
    if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
      const originalList = item.parentNode;
      // originalAlbumMap は主にドラッグ＆ドロップ用。ダブルクリックでは厳密には不要だが、一貫性のため
      originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null); 
      console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
      
      // アルバムリストからアイテムを非表示にする
      item.style.display = 'none';
      console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

      const itemData = {
        itemId: item.dataset.itemId,
        name: item.dataset.songName,
        albumClass: Array.from(item.classList).find(cls => cls.startsWith('album')),
        short: item.classList.contains('short') || (item.querySelector('input[type="checkbox"]') && item.querySelector('input[type="checkbox"]').checked),
        isShortVersion: item.classList.contains('short') 
      };
      fillSlotWithItem(emptySlot, itemData);
      console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
    } else {
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
    }
  }
}
// イベントリスナーを一度だけ追加
document.addEventListener("dblclick", handleDoubleClick);


/*------------------------------------------------------------------------------------------------------------*/


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


/**
 * 現在のセットリストの状態とメニューの状態、およびoriginalAlbumMapをオブジェクトで取得する。
 * @returns {object} 現在の状態
 */
function getCurrentState() {
  const setlistState = Array.from(setlist.children)
    .map(slot => {
      if (slot.classList.contains('setlist-item')) {
        const songInfo = slot.querySelector('.song-info');
        const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : slot.dataset.songName;
        const checkbox = slot.querySelector('input[type="checkbox"]');
        const isCheckedShort = checkbox ? checkbox.checked : false; // 現在のチェック状態

        const albumClass = Array.from(slot.classList).find(className => className.startsWith('album'));
        const itemId = slot.dataset.itemId;

        // ★ 追加: 元のアルバムアイテムがショート属性を持つかどうかを取得
        const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        const isOriginalShortVersion = originalAlbumItem ? originalAlbumItem.classList.contains('short') : false;

        return {
          name: songName,
          short: isCheckedShort,        // チェック状態
          isShortVersion: isOriginalShortVersion, // その曲がショートバージョンであるかどうかの属性
          albumClass: albumClass,
          itemId: itemId,
          slotIndex: slot.dataset.slotIndex
        };
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
  console.log("[getCurrentState] Setlist state for saving:", setlistState);
  console.log("[getCurrentState] Original album map for saving:", originalAlbumMapAsObject);

  return {
    setlist: setlistState,
    menuOpen: menuOpen,
    openAlbums: openAlbums,
    originalAlbumMap: originalAlbumMapAsObject
  };
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

  const currentState = getCurrentState();
  const setlistRef = database.ref('setlists').push();

  setlistRef.set(currentState)
    .then(() => {
        const shareId = setlistRef.key;
        const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

        // セットリストのテキストを生成 (共有ダイアログの本文に含めるため)
        const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
        let songListText = "";
        if (setlistItems.length > 0) {
            songListText = Array.from(setlistItems).map((slot, index) => {
                const songInfo = slot.querySelector(".song-info");
                const songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : slot.dataset.songName;
                const checkbox = slot.querySelector("input[type='checkbox']");
                return checkbox && checkbox.checked ? ` ${index + 1}. ${songName} (Short)` : ` ${index + 1}. ${songName}`;
            }).join("\n");
        }

        if (navigator.share) {
            navigator.share({
                title: '仮セトリ', // 共有ダイアログのタイトル
                text: `セットリストを共有します！\n\n${songListText}`, // 共有されるテキスト
                url: shareLink, // 共有されるURL (URLボタンのメイン機能)
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
            // Web Share API非対応の場合、URLをクリップボードにコピー
            const tempInput = document.createElement('textarea');
            tempInput.value = shareLink;
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
  return new Promise((resolve, reject) => { // ★ 変更点: Promise を返す
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('shareId');

    if (shareId) {
      if (typeof firebase === 'undefined' || !firebase.database) {
        showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
        console.error('Firebase is not initialized or firebase.database is not available.');
        return reject(new Error('Firebase not initialized.')); // エラーをreject
      }

      console.log(`[loadSetlistState] Loading state for shareId: ${shareId}`);
      const setlistRef = database.ref(`setlists/${shareId}`);
      setlistRef.once('value')
        .then((snapshot) => {
          const state = snapshot.val();
          if (state && state.setlist) {
            console.log("[loadSetlistState] State loaded:", state);
            
            // ★ リセット処理をここに集約
            // セットリストを初期状態に戻す (全てのスロットを空にする)
            for (let i = 0; i < maxSongs; i++) {
              clearSlotContent(setlist, i.toString());
            }
            // すべてのアルバムアイテムを表示状態に戻す（念のため、隠れているものを元に戻す）
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.display = '';
            });
            originalAlbumMap.clear(); // 既存のマップをクリア
            console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

            // originalAlbumMap を復元
            if (state.originalAlbumMap) {
              for (const key in state.originalAlbumMap) {
                originalAlbumMap.set(key, state.originalAlbumMap[key]);
              }
              console.log("[loadSetlistState] originalAlbumMap restored:", originalAlbumMap);
            }

            // セットリストに曲を埋め込み、同時にアルバムメニューから非表示にする
            state.setlist.forEach(itemData => {
              const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
              if (targetSlot) {
                  console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                  fillSlotWithItem(targetSlot, itemData);

                  // セットリストにロードされたアイテムは、アルバムリストから非表示にする
                  const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
                  if (albumItemInMenu) {
                      albumItemInMenu.style.display = 'none';
                      console.log(`[loadSetlistState] Hid album item in menu: ${itemData.itemId}`);
                  }
              } else {
                  console.warn(`[loadSetlistState] Target slot not found for index: ${itemData.slotIndex}`);
              }
            });

            // メニューとアルバムの開閉状態を復元 (オプション)
            if (state.menuOpen) {
              menu.classList.add('open');
              menuButton.classList.add('open');
            } else {
              menu.classList.remove('open');
              menuButton.classList.remove('open');
            }
            if (state.openAlbums && Array.isArray(state.openAlbums)) {
              document.querySelectorAll('.album-content').forEach(album => album.classList.remove('active')); // 全て閉じる
              state.openAlbums.forEach(albumId => {
                const albumElement = document.getElementById(albumId);
                if (albumElement) {
                  albumElement.classList.add('active');
                }
              });
            }
            resolve(); // 成功したら resolve を呼ぶ
          } else {
            showMessageBox('共有されたセットリストが見つかりませんでした。');
            console.warn("[loadSetlistState] Shared setlist state not found or invalid.");
            resolve(); // データがなくても成功として解決 (次の処理に進めるため)
          }
        })
        .catch((error) => {
          console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
          showMessageBox('セットリストのロードに失敗しました。');
          reject(error); // エラーを reject
        });
    } else {
      console.log("[loadSetlistState] No shareId found in URL. Loading default state.");
      // shareId がない場合も Promise を解決する
      resolve(); 
    }
  });
}

// ★ 新しいヘルパー関数：セットリスト内のアイテムをアルバムメニューから非表示にする
// この関数は、loadSetlistStateの完了後、または通常読み込み時に呼び出される
function hideSetlistItemsInMenu() {
    const currentSetlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    console.log("[hideSetlistItemsInMenu] Checking setlist items to hide in album menu.");
    currentSetlistItems.forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItemInMenu) {
                albumItemInMenu.style.display = 'none';
                console.log(`[hideSetlistItemsInMenu] Hid album item in menu: ${itemId}`);
            } else {
                console.warn(`[hideSetlistItemsInMenu] Album item for ID: ${itemId} not found in menu to hide.`);
            }
        }
    });
}

// 文字共有機能 (スロット対応版)
function shareTextSetlist() {
  const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
  if (setlistItems.length === 0) {
    showMessageBox("セットリストに曲がありません！");
    console.log("[shareTextSetlist] Setlist is empty.");
    return;
  }
  // 共有テキストを生成
  const songListText = Array.from(setlistItems).map((slot, index) => {
    const songInfo = slot.querySelector(".song-info");
    const songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : slot.dataset.songName;
    const checkbox = slot.querySelector("input[type='checkbox']");
    return checkbox && checkbox.checked ? ` ${index + 1}. ${songName} (Short)` : ` ${index + 1}. ${songName}`;
  }).join("\n");
  const fullTextToShare = `仮セトリ\n${songListText}`; // タイトルとリストを結合

  console.log("[shareTextSetlist] Generated song list for text share:\n", fullTextToShare);

  if (navigator.share) {
    // Web Share APIでテキストのみを共有
    navigator.share({
      title: "仮セトリ (テキスト)", // テキスト共有用のタイトル
      text: fullTextToShare // 生成したテキスト
    })
    .then(() => {
        console.log('[shareTextSetlist] Web Share API (Text) Success');
        showMessageBox('セットリストのテキストを共有しました！');
    })
    .catch(error => {
        console.error('[shareTextSetlist] Web Share API (Text) Failed:', error);
        if (error.name !== 'AbortError') {
            showMessageBox('テキスト共有に失敗しました。');
        }
    });
  } else {
    // Web Share API非対応の場合、クリップボードにコピー
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
  messageBox.style.opacity = '0'; // 一旦非表示に
  messageBox.style.display = 'block'; // 表示状態に

  // フェードイン
  setTimeout(() => {
    messageBox.style.opacity = '1';
  }, 10);

  // フェードアウトして非表示
  setTimeout(() => {
    messageBox.style.opacity = '0';
    messageBox.addEventListener('transitionend', function handler() {
      messageBox.style.display = 'none';
      messageBox.removeEventListener('transitionend', handler);
    }, {once: true});
  }, 2000); // 2秒後に消える
  console.log(`[showMessageBox] Displaying message: "${message}"`);
}

// DOMContentLoaded イベントリスナー
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop.");

  // 各アルバムコンテンツの.item要素にdraggable属性とdata属性を付与
  document.querySelectorAll(".album-content").forEach(album => {
    album.querySelectorAll(".item").forEach((item) => {
      item.draggable = true;
    });
    // 各アルバムコンテンツ自体にドラッグイベントを設定（アイテムの親要素として）
    enableDragAndDrop(album); 
    console.log(`[DOMContentLoaded] Enabled drag and drop for album: ${album.id}`);
  });

  // セットリストの各スロットにデータ属性を付与し、初期のイベントリスナーを設定
  setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
    if (!slot.dataset.slotIndex) {
        slot.dataset.slotIndex = index.toString();
    }
  });
  // セットリスト全体にドラッグ＆ドロップ関連のイベントを設定
  enableDragAndDrop(setlist); 
  console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

  // ★ 変更点: loadSetlistState の呼び出しと、その後の処理を整理
  // loadSetlistState が Promise を返すようにする (または Promise をラップする)
  // loadSetlistState の中では既にアルバムアイテムの非表示処理があるため、
  // ここではloadSetlistStateが完了した後に、それでも隠れていないものがあれば隠す最終チェックを行う
  loadSetlistState().then(() => {
    console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
    // ロードが完了した後、現在のセットリスト内のアイテムをアルバムから非表示にする最終チェック
    hideSetlistItemsInMenu(); 
  }).catch(error => {
    console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
    // エラー時も非表示処理は試みる
    hideSetlistItemsInMenu();
  });
});