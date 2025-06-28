let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムIDを保持 (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap

// originalSetlistSlot は、PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す
let originalSetlistSlot = null; 

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26; 

let currentDropZone = null; 
let activeTouchSlot = null;


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} list - 有効にするリストの要素
 */
function enableDragAndDrop(list) {
  if (list !== setlist) {
    list.querySelectorAll(".item").forEach(item => {
      // ... (既存のdata-itemId, data-songName初期化) ...
      item.draggable = true;

      item.addEventListener("dragstart", handleDragStart);
      // dragend は finishDragging でグローバルな状態をリセットする。
      // 個別の要素に毎回リスナーを追加する必要はない。
      // item.addEventListener("dragend", finishDragging); // ここは重複除去
      
      item.addEventListener("touchstart", handleTouchStart, { passive: false });
      item.addEventListener("touchmove", handleTouchMove, { passive: false });
      item.addEventListener("touchend", handleTouchEnd);
      item.addEventListener("touchcancel", handleTouchEnd);
    });
  }

  list.querySelectorAll(".setlist-slot").forEach(slot => {
    slot.addEventListener("dragover", handleDragOver);
    slot.addEventListener("drop", handleDrop);
    slot.addEventListener("dragenter", handleDragEnter);
    slot.addEventListener("dragleave", handleDragLeave);

    // ★ 修正: setlist-item クラスが最初から付与されているスロットに対する dragstart/dragend は削除
    // fillSlotWithItem で適切に付与・再付与されるため、ここでは不要。
    // if (slot.classList.contains('setlist-item')) { // このブロック全体を削除
    //   slot.draggable = true;
    //   slot.addEventListener("dragstart", handleDragStart);
    //   slot.addEventListener("dragend", finishDragging);
    //   slot.addEventListener("touchstart", handleTouchStart, { passive: false });
    //   slot.addEventListener("touchmove", handleTouchMove, { passive: false });
    //   slot.addEventListener("touchend", handleTouchEnd);
    //   slot.addEventListener("touchcancel", handleTouchEnd);
    // }
  });
}

// Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
// これにより、どこでドラッグが終わっても確実に状態をリセットできる
document.addEventListener("dragend", finishDragging);


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
  const draggedElement = event.target.closest(".item") || event.target.closest(".setlist-item");
  if (draggedElement) {
    currentPcDraggedElement = draggedElement; // PCでは元の要素が currentPcDraggedElement になる
    draggingItemId = draggedElement.dataset.itemId;

    if (currentPcDraggedElement.parentNode === setlist && currentPcDraggedElement.classList.contains('setlist-item')) {
      originalSetlistSlot = currentPcDraggedElement; // ドラッグ元のスロットを記憶 (元の要素自体)
      console.log(`[dragstart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}`);
    } else {
      originalSetlistSlot = null; // アルバムからのドラッグ
    }

    if (!originalAlbumMap.has(draggingItemId)) {
      const originalList = draggedElement.parentNode;
      const originalListId = originalList ? originalList.id : null;
      originalAlbumMap.set(draggingItemId, originalListId);
      console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
    } else {
      console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
    }

    currentPcDraggedElement.classList.add("dragging");
    event.dataTransfer.setData("text/plain", draggedElement.dataset.itemId);
    event.dataTransfer.effectAllowed = "move";
    console.log(`[dragstart] dataTransfer set with: ${draggedElement.dataset.itemId}`);
    console.log(`[dragstart] currentPcDraggedElement element:`, currentPcDraggedElement);
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
  // どちらのドラッグアイテムも存在しない場合は処理をスキップ
  if (!currentPcDraggedElement && !currentTouchDraggedClone) return; 

  const targetSlot = event.target.closest('.setlist-slot');
  if (targetSlot) {
    // PCドラッグの場合、自分自身の上に乗った場合はハイライトしない
    if (currentPcDraggedElement && targetSlot === currentPcDraggedElement) {
      if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
      }
      return;
    }
    // タッチドラッグの場合、元のスロット（プレースホルダー）の上に乗ってもハイライトしない
    if (currentTouchDraggedClone && targetSlot === originalSetlistSlot) { // originalSetlistSlotがプレースホルダーの場合
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
  
  // PCドラッグでは、元のDOM要素をIDで探し直す
  const draggedItem = document.querySelector(`[data-item-id="${droppedItemId}"]`); 

  if (!draggedItem) {
    console.error("[handleDrop] draggedItem not found in DOM with itemId:", droppedItemId, ". This can happen if the element was moved or removed unexpectedly before drop.");
    finishDragging();
    return;
  }
  console.log("[handleDrop] draggedItem found (PC original element):", draggedItem);

  const dropTargetSlot = event.target.closest('.setlist-slot');
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

  if (dropTargetSlot) {
    // processDrop には元の要素 (draggedItem) と originalSetlistSlot を渡す
    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);
  } else {
    // スロット以外にドロップされた場合 (PCではセットリスト外へのドラッグによる削除)
    console.warn("[handleDrop] Dropped outside a setlist slot. Attempting to restore to original list or remove.");
    restoreToOriginalList(draggedItem); // restoreToOriginalList に元の要素を渡す
  }
  finishDragging();
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ開始時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchStart(event) {
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;
  if (tapLength < 300 && tapLength > 0) {
    event.preventDefault();
    handleDoubleClick(event);
    lastTapTime = 0;
    console.log("[touchstart] Double tap detected.");
    return;
  }
  lastTapTime = currentTime;

  if (event.touches.length === 1) {
    const touchedElement = event.target.closest(".item") || event.target.closest(".setlist-item");
    if (touchedElement) {
      event.preventDefault();
      isDragging = false; // ドラッグ開始の可能性をリセット
      draggingItemId = touchedElement.dataset.itemId;

      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      console.log(`[touchstart:Mobile] Possible drag start for item: ${draggingItemId}`);

      setTimeout(() => {
        if (!isDragging && touchedElement && touchedElement.parentNode) {
          isDragging = true;
          console.log(`[touchstart:Mobile] Dragging initiated after delay for item: ${draggingItemId}`);

          // ★ タッチドラッグ用のクローン要素を作成 ★
          currentTouchDraggedClone = touchedElement.cloneNode(true);
          currentTouchDraggedClone.classList.add("dragging");
          document.body.appendChild(currentTouchDraggedClone); // body直下に追加

          // 元の要素（touchedElement）がセットリスト内のスロットだった場合
          if (touchedElement.parentNode === setlist && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement; // 元のセットリストスロットを記憶 (DOM要素)
            clearSlotContent(originalSetlistSlot.parentNode, originalSetlistSlot.dataset.slotIndex); // 元のスロットをクリアしてプレースホルダー化
            originalSetlistSlot.classList.add('placeholder-slot'); 
            console.log(`[touchstart:Mobile] Original slot ${originalSetlistSlot.dataset.slotIndex} converted to placeholder.`);
          } else {
            // アルバムリストのアイテムをドラッグした場合、元のアイテムは隠す
            touchedElement.style.display = 'none';
            originalSetlistSlot = null; // アルバムからのドラッグなのでリセット
          }

          if (!originalAlbumMap.has(draggingItemId)) {
            const originalList = touchedElement.parentNode;
            const originalListId = originalList ? originalList.id : null;
            originalAlbumMap.set(draggingItemId, originalListId);
            console.log(`[touchstart:Mobile] Original list for ${draggingItemId} set to: ${originalListId}`);
          }

          // ドラッグ中のクローン要素を画面の一番手前に持ってくる
          currentTouchDraggedClone.style.position = 'fixed';
          currentTouchDraggedClone.style.zIndex = '1000';
          const rect = touchedElement.getBoundingClientRect(); 
          currentTouchDraggedClone.style.width = rect.width + 'px';
          currentTouchDraggedClone.style.height = rect.height + 'px';
          currentTouchDraggedClone.style.left = touchStartX - rect.width / 2 + 'px';
          currentTouchDraggedClone.style.top = touchStartY - rect.height / 2 + 'px';

          setlist.querySelectorAll('.setlist-slot').forEach(slot => {
            slot.classList.add('active-drop-target');
          });
        }
      }, 100); 
    }
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
  if (currentTouchDraggedClone && isDragging) { 
    event.preventDefault();

    const touch = event.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    currentTouchDraggedClone.style.left = clientX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
    currentTouchDraggedClone.style.top = clientY - currentTouchDraggedClone.offsetHeight / 2 + 'px';

    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot && targetSlot !== activeTouchSlot) {
      if (activeTouchSlot) {
        activeTouchSlot.classList.remove('drag-over');
      }
      // タッチドラッグの場合、元のスロット（プレースホルダー）の上に乗ってもハイライトしない
      if (targetSlot !== originalSetlistSlot) { 
        targetSlot.classList.add('drag-over');
        activeTouchSlot = targetSlot;
      }
    } else if (!targetSlot && activeTouchSlot) {
      activeTouchSlot.classList.remove('drag-over');
      activeTouchSlot = null;
    }
  } else if (!isDragging && draggingItemId) { // まだドラッグが開始されてないが、アイテムIDがあり少し動いた場合
    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const dx = Math.abs(currentX - touchStartX);
    const dy = Math.abs(currentY - touchStartY);
    if (dx > 5 || dy > 5) { 
      isDragging = true;
      console.log(`[touchmove:Mobile] Dragging started due to movement for item: ${draggingItemId}`);
      
      const touchedElement = document.querySelector(`[data-item-id="${draggingItemId}"]`);
      if (touchedElement) {
          // ★ ドラッグ開始時と同様にクローンを作成し、元の要素を処理 ★
          currentTouchDraggedClone = touchedElement.cloneNode(true);
          currentTouchDraggedClone.classList.add("dragging");
          document.body.appendChild(currentTouchDraggedClone);

          if (touchedElement.parentNode === setlist && touchedElement.classList.contains('setlist-item')) {
              originalSetlistSlot = touchedElement;
              clearSlotContent(originalSetlistSlot.parentNode, originalSetlistSlot.dataset.slotIndex);
              originalSetlistSlot.classList.add('placeholder-slot');
              console.log(`[touchmove:Mobile] Original slot ${originalSetlistSlot.dataset.slotIndex} converted to placeholder due to movement.`);
          } else {
              touchedElement.style.display = 'none';
              originalSetlistSlot = null;
          }
          currentTouchDraggedClone.style.position = 'fixed';
          currentTouchDraggedClone.style.zIndex = '1000';
          const rect = touchedElement.getBoundingClientRect();
          currentTouchDraggedClone.style.width = rect.width + 'px';
          currentTouchDraggedClone.style.height = rect.height + 'px';
          currentTouchDraggedClone.style.left = currentX - rect.width / 2 + 'px';
          currentTouchDraggedClone.style.top = currentY - rect.height / 2 + 'px';

          if (!originalAlbumMap.has(draggingItemId)) {
            const originalList = touchedElement.parentNode;
            const originalListId = originalList ? originalList.id : null;
            originalAlbumMap.set(draggingItemId, originalListId);
            console.log(`[touchmove] Original list for ${draggingItemId} set to: ${originalListId}`);
          }

          setlist.querySelectorAll('.setlist-slot').forEach(slot => {
            slot.classList.add('active-drop-target');
          });
          event.preventDefault();
      } else {
          console.error("[handleTouchMove] Touched element not found for starting drag.");
          finishDragging();
          return;
      }
    }
  }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
  // ドラッグ操作自体が行われなかった場合（短いタップ）の処理
  if (!isDragging) {
    console.log("[touchend:Mobile] Drag not initiated. Assuming tap/click.");
    // originalSetlistSlot がプレースホルダーになっている可能性があれば、元に戻す
    if (originalSetlistSlot && originalSetlistSlot.classList.contains('placeholder-slot')) {
      console.log("[touchend:Mobile] Restoring original slot from placeholder after non-drag touch.");
      // draggingItemId を持つ元のアルバムアイテムのデータを取得し、スロットに戻す
      const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${draggingItemId}"]`);
      // draggingItemId を持つ要素がアルバムメニューに見つからなければ、セットリスト内の別の場所を探す
      const originalSetlistItem = originalSetlistSlot.querySelector(`.setlist-item[data-item-id="${draggingItemId}"]`) || originalSetlistSlot; // originalSetlistSlot自体がそのアイテムの場合も考慮

      if (originalAlbumItem) { // アルバムメニューに元のアイテムがある場合
          const originalItemData = {
              itemId: originalAlbumItem.dataset.itemId,
              name: originalAlbumItem.dataset.songName,
              albumClass: Array.from(originalAlbumItem.classList).find(cls => cls.startsWith('album')),
              short: originalAlbumItem.classList.contains('short'),
              isShortVersion: originalAlbumItem.classList.contains('short')
          };
          fillSlotWithItem(originalSetlistSlot, originalItemData);
          originalSetlistSlot.classList.remove('placeholder-slot');
          originalAlbumItem.style.display = ''; // アルバムアイテムも表示に戻す
      } else if (originalSetlistItem.classList.contains('setlist-item') && originalSetlistItem.dataset.itemId === draggingItemId) {
          // セットリスト内移動で、元のスロットがプレースホルダー化されていた場合
          // draggingItemId に紐づくアイテムデータを、元のスロットから再構築
          const itemDataInOriginalSlot = getSlotItemData(originalSetlistItem); // プレースホルダーになる前の状態
          if (itemDataInOriginalSlot) {
              fillSlotWithItem(originalSetlistSlot, itemDataInOriginalSlot);
              originalSetlistSlot.classList.remove('placeholder-slot');
          } else {
              console.warn("[touchend:Mobile] Could not get original item data from originalSetlistItem. Clearing slot.");
              clearSlotContent(originalSetlistSlot.parentNode, originalSetlistSlot.dataset.slotIndex);
              originalSetlistSlot.classList.remove('placeholder-slot');
          }
      } else {
          console.warn("[touchend:Mobile] Original item not found for restoring placeholder. Clearing slot.");
          clearSlotContent(originalSetlistSlot.parentNode, originalSetlistSlot.dataset.slotIndex);
          originalSetlistSlot.classList.remove('placeholder-slot');
      }
    }
    // currentTouchDraggedClone が存在する場合、それが一時的なクローンであれば削除
    if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
        currentTouchDraggedClone.remove();
        console.log("[touchend:Mobile] Removed temporary currentTouchDraggedClone after non-drag.");
    }
    finishDragging(); // グローバル変数をリセット
    return; // ここで処理を終了
  }

  // 以下、isDragging が true の場合（ドラッグが実際に行われた場合）の処理
  if (currentTouchDraggedClone) {
    // ドラッグ中のクローン要素のスタイルをリセット
    currentTouchDraggedClone.classList.remove("dragging");
    currentTouchDraggedClone.style.position = '';
    currentTouchDraggedClone.style.zIndex = '';
    currentTouchDraggedClone.style.width = '';
    currentTouchDraggedClone.style.height = '';
    currentTouchDraggedClone.style.left = '';
    currentTouchDraggedClone.style.top = '';
    console.log(`[touchend:Mobile] Dragging styles reset for clone: ${draggingItemId}`);
  }

  setlist.querySelectorAll('.setlist-slot.active-drop-target').forEach(slot => {
    slot.classList.remove('active-drop-target');
  });

  event.preventDefault(); 

  const touch = event.changedTouches[0];
  const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
  const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
  console.log("[touchend:Mobile] Drop target slot:", dropTargetSlot);

  // processDrop にはクローン要素と originalSetlistSlot を渡す
  processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

  // ★ クローン要素を必ずDOMから削除 ★
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
      currentTouchDraggedClone.remove();
      console.log("[touchend:Mobile] Removed temporary currentTouchDraggedClone (clone) from body.");
  }

  finishDragging(); 
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドロップ処理の共通関数。
 * @param {Element} currentDraggedElement - 現在ドラッグされている要素 (PC: 元の要素, Mobile: クローン要素)
 * @param {Element} dropTargetSlot - ドロップされたターゲットスロット (li.setlist-slot)
 * @param {Element|null} originalSetlistSlot - ドラッグ元のセットリストスロット (PC: 元の要素そのもの, Mobile: プレースホルダー化した元のスロット)
 */
function processDrop(currentDraggedElement, dropTargetSlot, originalSetlistSlot = null) {
  console.log("[processDrop] Called with currentDraggedElement (draggable):", currentDraggedElement, "and dropTargetSlot:", dropTargetSlot);
  console.log("[processDrop] originalSetlistSlot (source slot if from setlist):", originalSetlistSlot);

  if (!currentDraggedElement) {
    console.error("[processDrop] Missing currentDraggedElement. Aborting drop.");
    return;
  }

  const draggedItemData = {
    itemId: currentDraggedElement.dataset.itemId,
    name: currentDraggedElement.dataset.songName,
    albumClass: Array.from(currentDraggedElement.classList).find(cls => cls.startsWith('album')),
    short: currentDraggedElement.classList.contains('short') || (currentDraggedElement.querySelector('input[type="checkbox"]') && currentDraggedElement.querySelector('input[type="checkbox"]').checked),
    isShortVersion: currentDraggedElement.dataset.isShortVersion === 'true'
  };

  const isDraggedFromSetlist = originalSetlistSlot !== null;
  const isPcDrag = (currentDraggedElement === currentPcDraggedElement); // PCの元の要素を操作しているか

  if (isDraggedFromSetlist) {
    console.log("[processDrop] Drag source is setlist item (reordering/removal).");

    if (dropTargetSlot && dropTargetSlot !== originalSetlistSlot) { // 有効なドロップゾーン（元の場所以外）にドロップされた場合
      if (dropTargetSlot.classList.contains('setlist-item')) {
        console.log("[processDrop] Dropping onto occupied slot (swap scenario).");
        const tempItemDataToSwap = getSlotItemData(dropTargetSlot); 

        // ドロップ先のアイテムを元のスロット（originalSetlistSlot）に戻す
        if (tempItemDataToSwap) {
          fillSlotWithItem(originalSetlistSlot, tempItemDataToSwap);
          originalSetlistSlot.classList.remove('placeholder-slot'); // プレースホルダー解除
        } else {
          console.error("[processDrop] Failed to extract data for swap. Restoring dragged item to original slot.");
          fillSlotWithItem(originalSetlistSlot, draggedItemData);
          originalSetlistSlot.classList.remove('placeholder-slot');
          return;
        }
        // ドラッグしたアイテムをドロップ先に配置
        fillSlotWithItem(dropTargetSlot, draggedItemData);

      } else { // 空のスロットにドロップされた場合 (移動)
        console.log("[processDrop] Dropping onto empty slot (move scenario).");
        fillSlotWithItem(dropTargetSlot, draggedItemData);
        // 元のスロット（originalSetlistSlot）はクリアする
        clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
      }
    } else { // 無効な場所、または元の場所に戻された場合
        console.log("[processDrop] Dropped outside a valid setlist slot or back to original position.");
        // 元のスロット（originalSetlistSlot）にアイテムを戻す
        fillSlotWithItem(originalSetlistSlot, draggedItemData);
        originalSetlistSlot.classList.remove('placeholder-slot'); // プレースホルダー解除
    }
    // PCドラッグの場合、ブラウザが元の要素を自動的に処理するので、
    // currentDraggedElement (PCの元の要素) 自体に対してはここでの追加のDOM操作は不要。
    // fillSlotWithItem がスロットの内容を更新する形なので、問題ないはず。
    // ただし、元の位置に要素を戻す or クリアする処理は originalSetlistSlot に対して行う。

  } else { // ドラッグ元がアルバムリストである場合 (新規追加)
    console.log("[processDrop] Drag source is album list (new addition).");
    
    // PCでは currentPcDraggedElement, Mobileでは currentTouchDraggedClone を指す
    const actualAlbumItem = document.querySelector(`.album-content .item[data-item-id="${draggedItemData.itemId}"]`);

    if (!dropTargetSlot || dropTargetSlot.classList.contains('setlist-item')) {
      console.log("[processDrop] Target slot is already occupied or invalid. Not adding album item.");
      showMessageBox('このスロットはすでに埋まっています。');
      // アルバムアイテムを表示に戻す
      if (actualAlbumItem) {
          actualAlbumItem.style.display = '';
          console.log("[processDrop] Restored original album item display (target occupied).");
      }
      return;
    }

    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
    if (currentSongCount >= maxSongs) {
      console.log("[processDrop] Setlistは最大曲数に達しています。");
      showMessageBox('セットリストは最大曲数に達しています。');
      // アルバムアイテムを表示に戻す
      if (actualAlbumItem) {
          actualAlbumItem.style.display = '';
          console.log("[processDrop] Restored original album item display (setlist full).");
      }
      return;
    }

    console.log("[processDrop] Filling slot with item from album list.");
    fillSlotWithItem(dropTargetSlot, draggedItemData);

    // アルバムリストの元のアイテムを非表示にする
    if (actualAlbumItem) {
      console.log("[processDrop] Hiding original album item:", actualAlbumItem);
      actualAlbumItem.style.display = 'none';
    } else {
      console.warn("[processDrop] Original album item not found in menu for hiding:", draggedItemData.itemId);
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
  const albumClass = songData.albumClass; // 例: "album1", "album2" など
  const isCurrentlyChecked = songData.short;

  // ★ 追加: 既存のalbumクラスを全て削除する
  Array.from(slotElement.classList).forEach(cls => {
      if (cls.startsWith('album')) {
          slotElement.classList.remove(cls);
      }
  });

  // songData.isShortVersion が true ならそれを最優先し、なければアルバムアイテムの short クラスを確認
  const originalAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
  const isOriginalAlbumItemShort = originalAlbumItem ? originalAlbumItem.classList.contains('short') : false;

  const shouldShowShortOption = songData.isShortVersion === true || isOriginalAlbumItemShort;

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
  // ★ ここで新しいalbumClassを追加
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }
  
  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  slotElement.dataset.isShortVersion = shouldShowShortOption ? 'true' : 'false';
  
  slotElement.draggable = true;
  // イベントリスナーの削除・再登録部分はそのまま

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
        slotToClear.removeAttribute('data-is-short-version'); // ★ 追加
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ終了時の処理。
 */
function finishDragging() {
  // PCドラッグの際のクラス削除
  if (currentPcDraggedElement) {
    currentPcDraggedElement.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class from PC item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }
  // タッチドラッグのクローンは handleTouchEnd で既に削除されるのでここでは不要

  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target', 'placeholder-slot'); 
  });
  currentDropZone = null;
  activeTouchSlot = null;
  
  // ★ グローバル変数をすべてリセット ★
  currentPcDraggedElement = null;
  currentTouchDraggedClone = null;
  draggingItemId = null;
  isDragging = false;
  originalSetlistSlot = null; 

  console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
}


/*------------------------------------------------------------------------------------------------------------*/


function restoreToOriginalList(itemToRestore) {
    const itemId = itemToRestore.dataset.itemId;
    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}`);

    // アルバムリストの元のアイテムを表示に戻す
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.display = ''; // 表示に戻す
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // アイテムがセットリスト内に残っていて、かつセットリストから完全に削除する意図の場合
    // (例: セットリストのアイテムをセットリスト外にドロップした場合など)
    // ただし、itemToRestoreがPCの元の要素の場合、ブラウザが移動/削除するため、
    // ここでclearSlotContentを呼ぶと二重処理になる可能性がある。
    // originalSetlistSlot (PCでは元の要素自体) と dropTargetSlot が異なる場合にのみ、
    // originalSetlistSlot の内容をクリアするように processDrop で調整済み。
    // restoreToOriginalListは、セットリスト外へのドロップで「削除」された場合に呼び出す。
    
    // if (itemToRestore.parentNode === setlist && itemToRestore.classList.contains('setlist-item')) { // この条件は削除
    //     const slotIndex = itemToRestore.dataset.slotIndex;
    //     console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotIndex} (assuming full removal).`);
    //     clearSlotContent(setlist, slotIndex);
    // }

    // ★ 修正: PCドラッグでは itemToRestore は元のDOM要素。
    // セットリストから外にドラッグされた場合、ブラウザは元の要素を削除しないので、ここでクリアが必要。
    // ただし、`processDrop`内で既に元のスロットをクリアしているため、ここでは不要。
    // `restoreToOriginalList`は主に「アルバムに戻す」機能と、セットリストから「完全に削除」する場合に特化。
    // この関数は`handleDrop`のelseブロックから呼ばれることを想定。
    // その場合、`itemToRestore`が`originalSetlistSlot`である可能性が高い。
    // したがって、この関数は「セットリストから削除する」場合のみ、元のスロットをクリアするべき。
    if (itemToRestore === originalSetlistSlot && itemToRestore.parentNode === setlist) {
        console.log(`[restoreToOriginalList] Clearing original setlist slot ${itemToRestore.dataset.slotIndex} due to out-of-bounds drop.`);
        clearSlotContent(setlist, itemToRestore.dataset.slotIndex);
    }


    // タッチドラッグで body 直下に作成されたクローン要素であれば削除
    if (itemToRestore === currentTouchDraggedClone && itemToRestore.parentNode === document.body) {
        itemToRestore.remove();
        console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body.");
    }
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


/*------------------------------------------------------------------------------------------------------------*/


// DOMContentLoaded イベントリスナー
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DOMContentLoaded] Page loaded. Initializing drag and drop.");

  document.querySelectorAll(".album-content").forEach(album => {
    album.querySelectorAll(".item").forEach((item) => {
      // DOMContentLoaded時にdraggable属性とデータ属性を付与
      item.draggable = true;
      if (!item.dataset.itemId) {
        item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      }
      if (!item.dataset.songName) {
        item.dataset.songName = item.textContent.trim();
      }
    });
    enableDragAndDrop(album); 
    console.log(`[DOMContentLoaded] Enabled drag and drop for album: ${album.id}`);
  });

  setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
    if (!slot.dataset.slotIndex) {
        slot.dataset.slotIndex = index.toString();
    }
  });
  enableDragAndDrop(setlist); 
  console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");

  loadSetlistState().then(() => {
    console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
    hideSetlistItemsInMenu(); 
  }).catch(error => {
    console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
    hideSetlistItemsInMenu();
  });
});