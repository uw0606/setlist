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

/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  // ★ setTimeout を完全に削除しました ★
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
    // === 追加のデバッグログ ===
    console.log("DataTransfer types (after setData):", event.dataTransfer.types);
    console.log("DataTransfer data 'text/plain' (after setData):", event.dataTransfer.getData("text/plain"));
    // ===========================
  } else {
    console.warn("[dragstart] No draggable item found.");
  }
}

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
      // console.log(`[dragover] Highlighting slot: ${targetSlot.dataset.slotIndex}`); // ログが多いのでコメントアウト
    }
  } else if (currentDropZone) { // スロット外に移動した場合
    currentDropZone.classList.remove('drag-over');
    currentDropZone = null;
    // console.log("[dragover] Moved outside setlist slots. De-highlighting.");
  }
}


/**
 * ドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
  event.preventDefault();
  console.log("[handleDrop] Drop event fired.");
  const droppedItemId = event.dataTransfer.getData("text/plain");
  console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`); // 引用符で囲んで空かどうか分かりやすくする
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
        // console.log(`[touchmove] Highlighting slot: ${targetSlot.dataset.slotIndex}`); // ログが多いのでコメントアウト
      }
    } else if (!targetSlot && activeTouchSlot) {
      activeTouchSlot.classList.remove('drag-over');
      activeTouchSlot = null;
      // console.log("[touchmove] Moved outside setlist slots. De-highlighting.");
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
      // 注: このブロックはダブルクリック処理と競合する可能性があるので注意が必要です。
      // ダブルクリックは handleDoubleClick で既に処理済みと仮定します。
      // ここでは、セットリストのアイテムを"タップ"したときに、元のスロットに戻す挙動を期待するかどうか再検討が必要です。
      // 現状、ダブルタップで戻るので、ここでは何もしないのが適切かもしれません。
      if (draggingItem.parentNode === setlist && draggingItem.classList.contains('setlist-item')) {
          console.log("[touchend] Item was in setlist, but no drag. Do nothing, double tap handles removal.");
          // 元のスロット内容を戻す必要があるかもしれない（タッチ開始時にクリアしたため）
          const originalSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${draggingItem.dataset.originalSlotIndex}"]`);
          if (originalSlot && !originalSlot.classList.contains('setlist-item')) { // スロットが空になっていたら
            fillSlotWithItem(originalSlot, draggingItem); // 内容を元に戻す
          }
      } else {
          console.log("[touchend] Item was from album, but no drag. Restore to album if not already there.");
          restoreToOriginalList(draggingItem);
      }
    }
  }
  finishDragging(); // 共通のドラッグ終了処理を呼び出す
}

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

  // ドラッグ元がセットリスト内のスロットである場合 (再配置)
  if (draggedItem.parentNode === setlist && draggedItem.classList.contains('setlist-item')) {
    console.log("[processDrop] Drag source is setlist item (reordering).");
    const originalSlotIndex = draggedItem.dataset.slotIndex;
    const originalSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${originalSlotIndex}"]`);

    if (originalSlot === dropTargetSlot) {
      console.log("[processDrop] Dropped back into same slot. No change.");
      // 同じスロットに戻された場合、元々クリアされていた内容を復元する
      if (originalSlot) fillSlotWithItem(originalSlot, draggedItem);
      return;
    }

    if (targetSlotHasItem) {
      // ドロップ先にも曲がある場合（スワップ）
      console.log("[processDrop] Dropping onto occupied slot (swap scenario).");
      const itemToSwap = dropTargetSlot; // ドロップ先の曲アイテム
      
      // 元のスロットにドロップ先の曲を移動
      if (originalSlot) fillSlotWithItem(originalSlot, itemToSwap);

      // ドロップ先のスロットにドラッグされた曲を移動
      fillSlotWithItem(dropTargetSlot, draggedItem);

    } else {
      // ドロップ先が空のスロットの場合（移動）
      console.log("[processDrop] Dropping onto empty slot (move scenario).");
      fillSlotWithItem(dropTargetSlot, draggedItem);
      // 元のスロットは空にする
      clearSlotContent(setlist, originalSlotIndex);
    }
  } else {
    // ドラッグ元がアルバムリストである場合 (新規追加)
    console.log("[processDrop] Drag source is album list (new addition).");
    // 曲数制限は、実際に曲が入っているスロットの数を数える
    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
    console.log(`[processDrop] Current song count in setlist: ${currentSongCount}`);
    
    if (targetSlotHasItem) {
      // ドロップ先が埋まっている場合、かつアルバムからの追加なら追加しない
      console.log("[processDrop] Target slot is already occupied. Not adding album item.");
      showMessageBox('このスロットはすでに埋まっています。');
      restoreToOriginalList(draggedItem); // 元に戻す
      return;
    }

    if (currentSongCount >= maxSongs) {
      console.log("[processDrop] Setlist is full. Not adding album item.");
      showMessageBox('セットリストは最大曲数に達しています。');
      restoreToOriginalList(draggedItem); // 元に戻す
      return;
    }

    console.log("[processDrop] Filling slot with item from album list.");
    fillSlotWithItem(dropTargetSlot, draggedItem);

    // アルバムリストから移動したアイテムを非表示にする
    const albumItem = document.querySelector(`.album-content .item[data-item-id="${draggedItem.dataset.itemId}"]`);
    if (albumItem) {
      console.log("[processDrop] Hiding original album item:", albumItem);
      albumItem.style.display = 'none';
    } else {
      console.warn("[processDrop] Original album item not found in menu for hiding:", draggedItem.dataset.itemId);
    }
  }
}

/**
 * セットリストのスロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {Element} itemToFill - スロットに入れる曲アイテム要素 (li.item または li.setlist-slot.setlist-item)
 */
function fillSlotWithItem(slotElement, itemToFill) {
  console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${itemToFill.dataset.itemId}`);
  // スロットの既存の内容をクリア
  slotElement.innerHTML = '';
  
  // itemToFill から曲情報を取得
  const songName = itemToFill.dataset.songName || itemToFill.textContent.trim();
  const itemId = itemToFill.dataset.itemId;
  // albumClass は itemToFill.classList から 'album' で始まるクラスを探す
  const albumClass = Array.from(itemToFill.classList).find(cls => cls.startsWith('album'));
  const isShortTrack = itemToFill.classList.contains('short');
  // チェックボックスの状態も取得 (itemToFillがセットリストアイテムの場合のみ存在)
  const isCheckboxChecked = itemToFill.querySelector('input[type="checkbox"]') ? itemToFill.querySelector('input[type="checkbox"]').checked : false;


  // スロットに曲情報のためのdivを追加
  const songInfoDiv = document.createElement('div');
  songInfoDiv.classList.add('song-info');
  songInfoDiv.textContent = songName;

  if (isShortTrack) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCheckboxChecked; // チェック状態を反映
    songInfoDiv.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(Short)';
    songInfoDiv.appendChild(label);
  }
  slotElement.appendChild(songInfoDiv);

  // スロットに setlist-item クラスとアルバムクラスを追加
  slotElement.classList.add('setlist-item', 'item'); // itemクラスも追加してドラッグ可能に
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }
  if (isShortTrack) { // shortトラックの場合もクラスを追加
      slotElement.classList.add('short');
  }

  // データ属性をスロットに転送
  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  // スロット自身が元のスロットインデックスを持つのは、スロット内移動時のために必要
  // アルバムからの追加の場合は originalSlotIndex は不要だが、既存のロジックに合わせて保持
  if (!slotElement.dataset.originalSlotIndex && slotElement.dataset.slotIndex) {
      slotElement.dataset.originalSlotIndex = slotElement.dataset.slotIndex;
  }
  
  // ドラッグ可能な状態にする
  slotElement.draggable = true;
  // ドラッグイベントリスナーを再設定（スロットが新しいアイテムになったため）
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


/**
 * 指定されたスロットの内容をクリアし、空のスロット状態に戻す。
 * @param {Element} parentList - スロットが属する親リスト (通常は setlist)
 * @param {string} slotIndex - クリアするスロットの data-slot-index
 */
function clearSlotContent(parentList, slotIndex) {
    const slotToClear = parentList.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (slotToClear) {
        console.log(`[clearSlotContent] Clearing slot: ${slotIndex}`);
        slotToClear.innerHTML = ''; // 内容をクリア
        slotToClear.classList.remove('setlist-item', 'item', 'short'); // クラスを削除
        // アルバムクラスも削除
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id'); // データ属性を削除
        slotToClear.removeAttribute('data-song-name');
        slotToClear.removeAttribute('data-original-slot-index'); // originalSlotIndexも削除
        slotToClear.draggable = false; // 空のスロットはドラッグできないようにする
        
        // 空のスロットの見た目を維持するため、元のCSSで設定される要素（例：slot-number）はJavaScriptでは追加しない
    }
}


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

/**
 * アイテムを元のリストに戻す。
 * @param {Element} item - 元に戻すアイテム (アルバムのli.item または セットリストのli.setlist-slot.setlist-item)
 */
function restoreToOriginalList(item) {
  const itemId = item.dataset.itemId;
  console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}`);
  const originalListId = originalAlbumMap.get(itemId);
  const originalList = originalListId ? document.getElementById(originalListId) : null;

  if (originalList) {
    // アルバムリストのアイテムを再表示
    const albumItem = originalList.querySelector(`.item[data-item-id="${itemId}"]`);
    if (albumItem) {
      albumItem.style.display = ''; // 表示に戻す
      console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        // もしアルバム内に元のアイテムが見つからない場合は、新しく作成して追加
        console.warn(`[restoreToOriginalList] Original album item not found for ID: ${itemId}. Creating new one.`);
        const newAlbumItem = document.createElement('li');
        newAlbumItem.classList.add('item');
        Array.from(item.classList).forEach(cls => {
            if (cls.startsWith('album') || cls === 'short') { // shortクラスも考慮
                newAlbumItem.classList.add(cls);
            }
        });
        newAlbumItem.dataset.itemId = itemId;
        newAlbumItem.dataset.songName = item.dataset.songName;
        newAlbumItem.textContent = item.dataset.songName; // テキスト内容を設定
        newAlbumItem.draggable = true;

        originalList.appendChild(newAlbumItem);
        enableDragAndDrop(originalList); // 新しく追加したアイテムにイベントリスナーを設定
    }
  } else {
    console.warn(`[restoreToOriginalList] Original list not found for item ID: ${itemId}. Removing from current view.`);
  }
  
  // セットリストからアイテムを削除するのではなく、そのスロットをクリアする
  if (item.parentNode === setlist && item.classList.contains('setlist-item')) {
      const slotIndex = item.dataset.slotIndex;
      console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotIndex}`);
      clearSlotContent(setlist, slotIndex);
  } else if (item.parentNode !== setlist && item.classList.contains('item')) {
      // draggingItem がアルバムリストのアイテムで、セットリストに入らずにドロップされた場合など
      // この場合、restoreToOriginalListが呼ばれるのは、例えばdropTargetSlotがnullだった場合など
      // もしalbumItemが既に非表示になっているならそのまま
      const albumItemCheck = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
      if (albumItemCheck && albumItemCheck.style.display === 'none') {
          albumItemCheck.style.display = ''; // 非表示になっていれば表示に戻す
          console.log(`[restoreToOriginalList] Album item was hidden, now visible: ${itemId}`);
      } else if (!albumItemCheck) {
          // アルバムにもセットリストにも存在しない（おかしい状態）か、既にアルバムから削除されている場合
          console.log(`[restoreToOriginalList] Item ${itemId} not found in album or setlist parent. Removing it if still in DOM.`);
          item.remove(); // DOMから削除
      }
  }
  originalAlbumMap.delete(itemId); // マップから削除
  console.log(`[restoreToOriginalList] originalAlbumMap cleared for ID: ${itemId}`);
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
  event.stopPropagation(); // 親要素へのイベント伝播を防ぐ
  console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

  const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

  if (isInsideSetlist) { // セットリスト内のアイテムをダブルクリックした場合
    console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
    restoreToOriginalList(item); // 元のリストに戻す関数を呼び出す
  } else { // アルバムリスト内のアイテムをダブルクリックした場合 (空いているスロットに自動追加)
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
    
    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      return;
    }

    // アイテムがまだセットリストにないことを確認 (二重追加防止)
    if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
      const originalList = item.parentNode;
      originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null);
      console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
      
      // アルバムリストから移動したアイテムを非表示にする
      item.style.display = 'none';
      console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

      fillSlotWithItem(emptySlot, item);
      console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
    } else {
        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
    }
  }
}
// イベントリスナーを一度だけ追加
document.addEventListener("dblclick", handleDoubleClick);


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
        const isShort = checkbox ? checkbox.checked : false;
        const albumClass = Array.from(slot.classList).find(className => className.startsWith('album'));
        const itemId = slot.dataset.itemId;
        const slotIndex = slot.dataset.slotIndex;
        return { name: songName, short: isShort, albumClass: albumClass, itemId: itemId, slotIndex: slotIndex };
      } else {
        return null; // 空のスロットはnullとして保存
      }
    })
    .filter(item => item !== null); // nullを除外

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

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
  const currentState = getCurrentState();
  const setlistRef = database.ref('setlists').push();

  setlistRef.set(currentState)
    .then(() => {
      const shareId = setlistRef.key;
      const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
      document.execCommand('copy'); // navigator.clipboard.writeText の代替
      showMessageBox('共有リンクをクリップボードにコピーしました！');
      console.log(`[shareSetlist] Setlist saved. Share ID: ${shareId}, Link: ${shareLink}`);
    })
    .catch((error) => {
      console.error('[shareSetlist] セットリストの保存に失敗しました:', error);
      showMessageBox('セットリストの保存に失敗しました。');
    });
}

/**
 * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
 */
function loadSetlistState() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('shareId');

  if (shareId) {
    console.log(`[loadSetlistState] Loading state for shareId: ${shareId}`);
    const setlistRef = database.ref(`setlists/${shareId}`);
    setlistRef.once('value')
      .then((snapshot) => {
        const state = snapshot.val();
        if (state && state.setlist) {
          console.log("[loadSetlistState] State loaded:", state);
          // セットリストを初期状態に戻す (全てのスロットを空にする)
          for (let i = 0; i < maxSongs; i++) {
            clearSlotContent(setlist, i.toString());
          }
          originalAlbumMap.clear(); // 既存のマップをクリア
          console.log("[loadSetlistState] Setlist cleared and originalAlbumMap reset.");

          // originalAlbumMap を復元
          if (state.originalAlbumMap) {
            for (const key in state.originalAlbumMap) {
              originalAlbumMap.set(key, state.originalAlbumMap[key]);
            }
            console.log("[loadSetlistState] originalAlbumMap restored:", originalAlbumMap);
          }

          state.setlist.forEach(itemData => {
            const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
            if (targetSlot) {
                console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                // 仮のアイテム要素を作成し、それをスロットに埋める
                const tempItem = document.createElement('li'); // ダミーとして使用
                tempItem.dataset.itemId = itemData.itemId;
                tempItem.dataset.songName = itemData.name;
                if (itemData.albumClass) tempItem.classList.add(itemData.albumClass);
                if (itemData.short) tempItem.classList.add('short');
                
                fillSlotWithItem(targetSlot, tempItem);

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
        } else {
          showMessageBox('共有されたセットリストが見つかりませんでした。');
          console.warn("[loadSetlistState] Shared setlist state not found or invalid.");
        }
      })
      .catch((error) => {
        console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
        showMessageBox('セットリストのロードに失敗しました。');
      });
  } else {
    console.log("[loadSetlistState] No shareId found in URL. Loading default state.");
  }
}

// 文字共有機能 (スロット対応版)
function shareTextSetlist() {
  const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
  if (setlistItems.length === 0) {
    showMessageBox("セットリストに曲がありません！");
    console.log("[shareTextSetlist] Setlist is empty.");
    return;
  }
  let songList = "\n" + Array.from(setlistItems).map((slot, index) => {
    const songInfo = slot.querySelector(".song-info");
    const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : slot.dataset.songName;
    const checkbox = slot.querySelector("input[type='checkbox']");
    return checkbox && checkbox.checked ? ` ${index + 1}. ${songName} (Short)` : ` ${index + 1}. ${songName}`;
  }).join("\n");
  console.log("[shareTextSetlist] Generated song list:\n", songList);

  if (navigator.share) {
    navigator.share({ title: "仮セトリ(テキスト)", text: songList })
      .catch(error => console.error('[shareTextSetlist] Share failed:', error));
  } else {
    const tempInput = document.createElement('textarea');
    tempInput.value = songList;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showMessageBox("セットリストのテキストをクリップボードにコピーしました！");
    console.log("[shareTextSetlist] Copied to clipboard (Web Share API not available).");
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
  const albumContents = document.querySelectorAll(".album-content");
  albumContents.forEach(album => {
    album.querySelectorAll(".item").forEach((item) => {
      if (!item.dataset.itemId) {
        item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        console.log(`[DOMContentLoaded] Assigned new itemId to album item: ${item.dataset.itemId}`);
      }
      if (!item.dataset.songName) {
        item.dataset.songName = item.textContent.trim();
        // console.log(`[DOMContentLoaded] Assigned songName to album item: ${item.dataset.songName}`); // ログが多いのでコメントアウト
      }
      item.draggable = true;
    });
    enableDragAndDrop(album); // アルバム内のアイテムにドラッグ＆ドロップを有効化
    console.log(`[DOMContentLoaded] Enabled drag and drop for album: ${album.id}`);
  });

  // セットリストの各スロットにデータ属性を付与し、初期のイベントリスナーを設定
  setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
    // 既にHTMLにあるので、再設定は不要。ただし念のため
    if (!slot.dataset.slotIndex) {
        slot.dataset.slotIndex = index.toString();
        // console.log(`[DOMContentLoaded] Assigned slotIndex to setlist slot: ${slot.dataset.slotIndex}`); // ログが多いのでコメントアウト
    }
    // スロット自体には初期はドラッグイベント不要（空だから）
    // ドロップイベントは enableDragAndDrop(setlist) で付与される
  });
  enableDragAndDrop(setlist); // セットリストのスロットにドロップイベントを有効化
  console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

  loadSetlistState(); // ページ読み込み時に共有IDがあれば状態をロード
});
