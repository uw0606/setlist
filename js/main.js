let currentPcDraggedElement = null; // PCドラッグ中に参照する元の要素
let currentTouchDraggedClone = null; // タッチドラッグ中に動かすクローン要素
let draggingItemId = null; // ドラッグ中のアイテムIDを保持 (PC/Mobile共通)
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false; // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
let touchTimeout = null; // setTimeout のIDを保持する変数。初期値をnullに統一。
const originalAlbumMap = new Map(); // 各アイテムの元のアルバムIDを保持するMap

// originalSetlistSlot は、PC/Mobile共通で、セットリスト内でドラッグ開始された「元のスロット要素」を指す
let originalSetlistSlot = null; 

const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");
const maxSongs = 26; 

let currentDropZone = null; 
let activeTouchSlot = null; // モバイルでのドロップゾーンハイライト用


/*------------------------------------------------------------------------------------------------------------*/


/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} list - 有効にするリストの要素
 */
function enableDragAndDrop(list) {
  if (list === setlist) {
    // セットリストのスロットには、初期状態では dragstart などのイベントは設定しない
    // setlist-item になった時に fillSlotWithItem で設定される
    list.querySelectorAll(".setlist-slot").forEach(slot => {
        slot.addEventListener("dragover", handleDragOver);
        slot.addEventListener("drop", handleDrop);
        slot.addEventListener("dragenter", handleDragEnter);
        slot.addEventListener("dragleave", handleDragLeave);
    });
  } else { // アルバムリストの場合
    list.querySelectorAll(".item").forEach(item => {
      // DOMContentLoaded で付与されているはずの data-itemId, data-songName を再確認
      if (!item.dataset.itemId) {
        item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      }
      if (!item.dataset.songName) {
        item.dataset.songName = item.textContent.trim();
      }
      item.draggable = true;

      // PC ドラッグイベント
      item.addEventListener("dragstart", handleDragStart);
      
      // タッチイベント
      item.addEventListener("touchstart", handleTouchStart, { passive: false });
      item.addEventListener("touchmove", handleTouchMove, { passive: false });
      item.addEventListener("touchend", handleTouchEnd);
      item.addEventListener("touchcancel", handleTouchEnd);
    });
  }
}

// Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
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
 * ドラッグ要素がドロップターゲットに入った時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDragEnter(event) {
  event.preventDefault();
  // ドラッグ中の要素がPCからのオリジナル要素か、タッチからのクローン要素かを確認
  // どちらかが存在すればドラッグ中と判断
  const activeDraggingElement = currentPcDraggedElement || currentTouchDraggedClone;

  if (activeDraggingElement) {
    const targetSlot = event.target.closest('.setlist-slot');
    // ドラッグ元のスロットがプレースホルダーの場合、そのスロット自体への drag-over は不要
    if (originalSetlistSlot && targetSlot === originalSetlistSlot) {
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
    if (currentTouchDraggedClone && originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) { 
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

    // ダブルタップ検出
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault(); // デフォルトのスクロールやズームを防止
        // ダブルタップ時は、ドラッグ開始のタイマーを即座にクリア
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // ダブルクリック処理を呼び出し、その中で finishDragging が呼ばれる
        handleDoubleClick(event);
        lastTapTime = 0;
        console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
        return;
    }
    lastTapTime = currentTime;

    if (event.touches.length === 1) {
        const touchedElement = event.target.closest(".item") || event.target.closest(".setlist-item");
        if (!touchedElement) {
            console.warn("[touchstart:Mobile] No draggable item found on touch start.");
            return;
        }

        event.preventDefault(); // デフォルトのスクロールやズームを防止
        // isDragging はまだ false のまま。移動量が閾値を超えたら true にする。
        // または長押しタイマーで true にする。
        isDragging = false;
        // **修正点**: draggingItemId を、touchedElement の dataset.itemId から確実に取得
        draggingItemId = touchedElement.dataset.itemId;

        // タッチ開始時に originalSetlistSlot を設定 (setlist-itemからのドラッグの場合)
        if (touchedElement.parentNode === setlist && touchedElement.classList.contains('setlist-item')) {
            originalSetlistSlot = touchedElement;
            console.log(`[touchstart:Mobile] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}`);
        } else {
            originalSetlistSlot = null; // アルバムからのドラッグ
        }

        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        console.log(`[touchstart:Mobile] Possible drag start for item: ${draggingItemId}`);

        // 短い遅延を設けて、タップとドラッグを区別
        // 既存のtouchTimeoutが存在する場合はクリアしておく
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }

        touchTimeout = setTimeout(() => {
            // timeoutが発火した時点で、まだ isDragging が false であり、
            // かつ draggingItemId が有効で、touchedElementがDOMに存在すればドラッグ開始
            if (!isDragging && draggingItemId && document.body.contains(touchedElement)) {
                console.log(`[touchstart:Mobile] Long press detected for item: ${draggingItemId}. Creating clone and starting drag.`);
                // **修正点**: draggingItemId を createTouchDraggedClone に渡す
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                isDragging = true; // クローンが作成されたらドラッグ状態にする
            } else {
                // draggingItemId が null になった、またはtouchedElementがDOMから消えた
                console.warn("[touchstart:Mobile] Dragging not initiated after timeout: State changed or element removed.");
                finishDragging(); // 何らかの問題が発生した場合はクリーンアップ
            }
            touchTimeout = null;
        }, 150); // 150ms 程度の長押しでドラッグ開始とみなす
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ移動時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
    // draggingItemId がない、またはタッチ数が1でない場合は何もしない
    if (!draggingItemId || event.touches.length !== 1) { 
        return;
    }

    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const dx = Math.abs(currentX - touchStartX);
    const dy = Math.abs(currentY - touchStartY);

    // まだドラッグが開始されていない場合 (isDragging === false)
    if (!isDragging) { 
        // 十分な移動量があり、かつドラッグ開始タイマーが設定されている場合
        if (dx > 5 || dy > 5) { // 閾値5pxを超えたらドラッグ開始
            // setTimeout がまだ実行されていなければクリアして即座にドラッグ開始
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }

            console.log(`[touchmove:Mobile] Dragging started due to significant movement for item: ${draggingItemId}`);
            
            // クローンがまだ作成されていなければ、ここで作成する
            if (!currentTouchDraggedClone) { 
                const touchedElement = document.querySelector(`[data-item-id="${draggingItemId}"]`);
                // 元の要素がDOMに存在するかを確認
                if (!touchedElement || !document.body.contains(touchedElement)) { 
                    console.error("[handleTouchMove] Touched element not found or removed from DOM for starting drag due to movement. Aborting.");
                    finishDragging();
                    return;
                }
                createTouchDraggedClone(touchedElement, touchStartX, touchStartY); // ここでクローンを作成する
                isDragging = true; // クローンが作成されたらドラッグ状態にする
            }
        } else {
            // 移動量が閾値未満であれば、まだドラッグ開始とはみなさない
            return;
        }
    }

    // isDragging が true になっていれば、クローンを動かす
    if (isDragging && currentTouchDraggedClone) { 
        event.preventDefault(); // クローンが存在しドラッグ中なら preventDefault を続ける

        currentTouchDraggedClone.style.left = currentX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
        currentTouchDraggedClone.style.top = currentY - currentTouchDraggedClone.offsetHeight / 2 + 'px';
        console.log(`[touchmove:Mobile] Clone position updated: left=${currentTouchDraggedClone.style.left}, top=${currentTouchDraggedClone.style.top}`);


        const elementsAtPoint = document.elementsFromPoint(currentX, currentY);
        const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

        // ドロップゾーンのハイライトロジック
        if (targetSlot) {
            // 元のスロット（プレースホルダー）の上に乗ってもハイライトしない
            if (originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
                if (activeTouchSlot) { // 以前ハイライトしていたスロットがあれば解除
                    activeTouchSlot.classList.remove('drag-over');
                    activeTouchSlot = null;
                }
                return; // 元のスロットならハイライトしない
            }

            // 新しいスロットに入った場合
            if (targetSlot !== activeTouchSlot) {
                if (activeTouchSlot) {
                    activeTouchSlot.classList.remove('drag-over');
                }
                targetSlot.classList.add('drag-over');
                activeTouchSlot = targetSlot;
            }
        } else if (activeTouchSlot) { // スロットから外れた場合
            activeTouchSlot.classList.remove('drag-over');
            activeTouchSlot = null;
        }
    } else if (isDragging && !currentTouchDraggedClone) {
        // isDraggingはtrueだがクローンがないという異常状態
        console.error("[handleTouchMove] isDragging is true but currentTouchDraggedClone is null. Aborting drag.");
        finishDragging(); 
    }
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * タッチ終了時の処理。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
    event.preventDefault(); 
    console.log("[touchend:Mobile] (or touchcancel) event fired. isDragging:", isDragging, "draggingItemId:", draggingItemId, "currentTouchDraggedClone:", currentTouchDraggedClone);

    // touchTimeout が残っていればクリアする (短いタップやダブルタップの場合)
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // ドラッグが実際に開始されていない場合 (isDragging が false) は、即座にクリーンアップして終了する
    if (!isDragging) { 
        console.log("[touchend:Mobile] Drag not initiated. Performing full cleanup and exit.");
        finishDragging(); 
        return; 
    }

    // ★ ここから isDragging が true の場合（ドラッグが実際に行われた場合）の処理 ★

    // currentTouchDraggedClone が存在しない場合は、これ以上の処理はできないため、ここで中止し、クリーンアップのみ行う
    if (!currentTouchDraggedClone) {
        console.error("[touchend:Mobile] currentTouchDraggedClone is null despite isDragging being true. Aborting touch end process.");
        finishDragging(); // クリーンアップのみ行って終了
        return;
    }
    
    // ドラッグ中のクローン要素のスタイルをリセット
    currentTouchDraggedClone.classList.remove("dragging");
    // NOTE: CSSでtransitionが設定されている場合、ここでスタイルを直接クリアすると意図しないアニメーションが発生する可能性あり
    // 代わりに、CSSクラスで管理することを検討する
    currentTouchDraggedClone.style.position = '';
    currentTouchDraggedClone.style.zIndex = '';
    currentTouchDraggedClone.style.width = '';
    currentTouchDraggedClone.style.height = '';
    currentTouchDraggedClone.style.left = '';
    currentTouchDraggedClone.style.top = '';
    console.log(`[touchend:Mobile] Dragging styles reset for clone: ${draggingItemId}`);

    // ドロップターゲットのハイライトを解除
    setlist.querySelectorAll('.setlist-slot.active-drop-target').forEach(slot => {
        slot.classList.remove('active-drop-target');
    });
    setlist.querySelectorAll('.setlist-slot.drag-over').forEach(slot => { 
        slot.classList.remove('drag-over');
    });

    const touch = event.changedTouches[0];
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    console.log("[touchend:Mobile] Drop target slot:", dropTargetSlot);

    // ドロップ処理を実行
    // currentTouchDraggedClone を渡すことで、processDrop 内でモバイルからのドラッグだと認識させる
    processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
    
    // 最後に必ず finishDragging を呼んで、すべての状態をリセットし、クローン要素を削除
    finishDragging(); 
}


/*------------------------------------------------------------------------------------------------------------*/


/**
 * クローン要素を作成し初期設定を行う。
 * @param {Element} originalElement - クローン元の要素
 * @param {number} initialX - クローンの初期X座標 (画面絶対座標)
 * @param {number} initialY - クローンの初期Y座標 (画面絶対座標)
 * @param {string} itemIdToClone - クローンするアイテムのitemId
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) { // **修正点**: itemIdToClone を追加
    console.log(`[createTouchDraggedClone] Attempting to create clone for: ${itemIdToClone}`); // **修正点**: ログに itemIdToClone を使用
    if (currentTouchDraggedClone) {
        console.warn("[createTouchDraggedClone] Existing clone detected before creating new one. Removing it.");
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null; // null にリセット
    }

    // 重要: originalElement が有効な要素であることを再確認
    if (!originalElement || !document.body.contains(originalElement)) {
        console.error("[createTouchDraggedClone] Original element is invalid or not in DOM. Aborting clone creation.");
        return;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging");
    // **修正点**: クローンにも itemId を設定
    currentTouchDraggedClone.dataset.itemId = itemIdToClone;
    document.body.appendChild(currentTouchDraggedClone);
    console.log(`[createTouchDraggedClone] Clone created and appended to body:`, currentTouchDraggedClone);


    // 元の要素（touchedElement）がセットリスト内のスロットだった場合
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        if (!originalSetlistSlot || originalSetlistSlot.dataset.slotIndex !== originalElement.dataset.slotIndex) {
            originalSetlistSlot = originalElement;
        }
        const originalItemData = getSlotItemData(originalElement);
        if (originalItemData) {
            originalSetlistSlot._originalItemData = originalItemData;
        }

        clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
        originalSetlistSlot.classList.add('placeholder-slot');
        console.log(`[createTouchDraggedClone] Original slot ${originalSetlistSlot.dataset.slotIndex} converted to placeholder.`);
    } else {
        // アルバムリストのアイテムをドラッグした場合、元のアイテムは隠す
        originalElement.style.display = 'none';
        originalSetlistSlot = null;
        console.log(`[createTouchDraggedClone] Original album item ${itemIdToClone} hidden.`); // **修正点**: ログに itemIdToClone を使用
    }

    // originalAlbumMapの設定（既に設定されている場合はスキップ）
    if (!originalAlbumMap.has(itemIdToClone)) { // **修正点**: itemIdToClone を使用
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId); // **修正点**: itemIdToClone を使用
        console.log(`[createTouchDraggedClone] Original list for ${itemIdToClone} set to: ${originalListId}`); // **修正点**: ログに itemIdToClone を使用
    }

    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    const rect = originalElement.getBoundingClientRect();
    currentTouchDraggedClone.style.width = rect.width + 'px';
    currentTouchDraggedClone.style.height = rect.height + 'px';

    currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';

    setlist.querySelectorAll('.setlist-slot').forEach(slot => {
        slot.classList.add('active-drop-target');
    });
    console.log(`[createTouchDraggedClone] Clone creation and initial setup complete for item: ${itemIdToClone}`); // **修正点**: ログに itemIdToClone を使用
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

  const itemId = draggingItemId || currentDraggedElement.dataset.itemId;
  if (!itemId) {
      console.error("[processDrop] Cannot determine itemId for dragged element. Aborting drop.");
      return;
  }

  let draggedItemData = {};
  // 元の要素（アルバムリスト内、またはセットリスト内）を探す
  const originalSourceElement = document.querySelector(`[data-item-id="${itemId}"]`);

  if (originalSourceElement) {
      draggedItemData = {
          itemId: itemId,
          name: originalSourceElement.dataset.songName || originalSourceElement.textContent.trim(),
          albumClass: Array.from(originalSourceElement.classList).find(cls => cls.startsWith('album')),
          short: originalSourceElement.classList.contains('short') || (originalSourceElement.querySelector('input[type="checkbox"]') && originalSourceElement.querySelector('input[type="checkbox"]').checked),
          isShortVersion: originalSourceElement.dataset.isShortVersion === 'true' || originalSourceElement.classList.contains('short')
      };
  } else if (originalSetlistSlot && originalSetlistSlot._originalItemData && originalSetlistSlot._originalItemData.itemId === itemId) {
      draggedItemData = originalSetlistSlot._originalItemData;
  } else {
      console.error("[processDrop] Could not determine item data for itemId:", itemId, ". Aborting drop.");
      return;
  }

  console.log("[processDrop] Constructed draggedItemData:", draggedItemData);

  const isDraggedFromSetlist = originalSetlistSlot && originalSetlistSlot.dataset.slotIndex &&
                                originalSetlistSlot._originalItemData && originalSetlistSlot._originalItemData.itemId === draggedItemData.itemId;

  if (isDraggedFromSetlist) {
    console.log("[processDrop] Drag source is setlist item (reordering/removal).");

    if (dropTargetSlot && dropTargetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
        console.log("[processDrop] Dropped back to original slot. Restoring content.");
        if (originalSetlistSlot._originalItemData) {
            fillSlotWithItem(originalSetlistSlot, originalSetlistSlot._originalItemData);
        } else {
            clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
        }
        originalSetlistSlot.classList.remove('placeholder-slot');
        return;
    }

    if (dropTargetSlot) {
      if (dropTargetSlot.classList.contains('setlist-item')) {
        console.log("[processDrop] Dropping onto occupied slot (swap scenario).");
        const tempItemDataToSwap = getSlotItemData(dropTargetSlot);

        if (tempItemDataToSwap && originalSetlistSlot) {
          fillSlotWithItem(originalSetlistSlot, tempItemDataToSwap);
          originalSetlistSlot.classList.remove('placeholder-slot');
        } else {
          console.warn("[processDrop] Failed to extract data for swap or originalSetlistSlot is null. Clearing original slot.");
          if (originalSetlistSlot) {
            clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
            originalSetlistSlot.classList.remove('placeholder-slot');
          }
        }
        fillSlotWithItem(dropTargetSlot, draggedItemData);

      } else { // 空のスロットにドロップされた場合 (移動)
        console.log("[processDrop] Dropping onto empty slot (move scenario).");
        fillSlotWithItem(dropTargetSlot, draggedItemData);
        if (originalSetlistSlot) {
            clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
            originalSetlistSlot.classList.remove('placeholder-slot');
        }
      }
    } else {
        console.log("[processDrop] Dropped outside a valid setlist slot. Restoring item to original slot.");
        if (originalSetlistSlot && originalSetlistSlot._originalItemData) {
            fillSlotWithItem(originalSetlistSlot, originalSetlistSlot._originalItemData);
            originalSetlistSlot.classList.remove('placeholder-slot');
        } else {
            console.error("[processDrop] originalSetlistSlot or its original item data missing for restoration.");
            // **修正点**: ここで currentDraggedElement ではなく itemId を使って元のアイテムを表示に戻す
            restoreToOriginalList(document.querySelector(`[data-item-id="${itemId}"]`));
        }
    }

  } else { // ドラッグ元がアルバムリストである場合 (新規追加)
    console.log("[processDrop] Drag source is album list (new addition).");

    const actualAlbumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);

    if (!dropTargetSlot || dropTargetSlot.classList.contains('setlist-item')) {
      console.log("[processDrop] Target slot is already occupied or invalid. Not adding album item.");
      showMessageBox('このスロットはすでに埋まっています。');
      // **修正点**: ドロップが失敗した場合、隠れていたアルバムアイテムを表示に戻す
      if (actualAlbumItem) {
          actualAlbumItem.style.display = '';
          console.log("[processDrop] Restored hidden album item due to invalid drop target.");
      }
      return;
    }

    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
    if (currentSongCount >= maxSongs) {
      console.log("[processDrop] Setlistは最大曲数に達しています。");
      showMessageBox('セットリストは最大曲数に達しています。');
      // **修正点**: セットリストが満杯でドロップが失敗した場合、隠れていたアルバムアイテムを表示に戻す
      if (actualAlbumItem) {
          actualAlbumItem.style.display = '';
          console.log("[processDrop] Restored hidden album item due to full setlist.");
      }
      return;
    }

    console.log("[processDrop] Filling slot with item from album list.");
    fillSlotWithItem(dropTargetSlot, draggedItemData);

    // **修正点**: createTouchDraggedCloneで既に非表示になっているはずなので、ここでの非表示処理は不要
    // アルバムアイテムがまだ非表示でない場合のみ非表示にする（冗長な処理を防ぐ）
    if (actualAlbumItem && actualAlbumItem.style.display !== 'none') {
      console.log("[processDrop] Hiding original album item:", actualAlbumItem);
      actualAlbumItem.style.display = 'none';
    } else if (!actualAlbumItem) {
      console.warn("[processDrop] Original album item not found in menu for hiding:", itemId);
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
    if (!slotElement || !slotElement.classList.contains('setlist-item')) {
        // console.warn("[getSlotItemData] Provided slotElement does not contain 'setlist-item' class or is null. Returning null.");
        return null;
    }
    const itemInSlot = slotElement;

    const songInfo = itemInSlot.querySelector('.song-info');
    const songName = songInfo ? Array.from(songInfo.childNodes).find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim() || '' : itemInSlot.dataset.songName;
    
    const checkbox = itemInSlot.querySelector('input[type="checkbox"]');
    const isCheckedShort = checkbox ? checkbox.checked : false; // 現在のチェック状態
    
    const albumClass = Array.from(itemInSlot.classList).find(className => className.startsWith('album'));
    const itemId = itemInSlot.dataset.itemId;

    // スロット自身の dataset.isShortVersion を読み込む
    // fillSlotWithItem で設定される値がここで取得される
    const isShortVersion = slotElement.dataset.isShortVersion === 'true'; 

    return {
        name: songName,
        short: isCheckedShort,        // チェックボックスの状態 (Shortとして表示されているか)
        isShortVersion: isShortVersion, // その曲がショートバージョンであるかどうかの属性
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

  // 既存のalbumクラスを全て削除する
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
  // ここで新しいalbumClassを追加
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }
  
  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  slotElement.dataset.isShortVersion = shouldShowShortOption ? 'true' : 'false';
  
  // イベントリスナーを一度削除し、再登録
  // これにより、同じ要素に重複してリスナーが付与されるのを防ぐ
  slotElement.removeEventListener("dragstart", handleDragStart);
  slotElement.removeEventListener("touchstart", handleTouchStart);
  slotElement.removeEventListener("touchmove", handleTouchMove);
  slotElement.removeEventListener("touchend", handleTouchEnd);
  slotElement.removeEventListener("touchcancel", handleTouchEnd);

  slotElement.draggable = true; // ドラッグ可能にする
  slotElement.addEventListener("dragstart", handleDragStart);
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
            // song-info-container自体に設定されたスタイルもリセット
            songInfoContainer.style = ''; 
        }
        
        // スロットのクラスとデータ属性を確実に削除
        slotToClear.classList.remove('setlist-item', 'item', 'short'); 
        // アルバムクラスも削除
        Array.from(slotToClear.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotToClear.classList.remove(cls);
            }
        });
        slotToClear.removeAttribute('data-item-id'); 
        slotToClear.removeAttribute('data-song-name');
        slotToClear.removeAttribute('data-is-short-version'); 

        // チェックボックス要素があれば削除する
        const existingCheckbox = slotToClear.querySelector('input[type="checkbox"]');
        if (existingCheckbox) {
            existingCheckbox.remove();
            console.log(`[clearSlotContent] Removed checkbox from slot: ${slotIndex}`);
        }
        
        // song-info-container 以外のスロット直下の子要素も確実に削除
        Array.from(slotToClear.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('song-info-container'))) {
                node.remove();
            }
        });
        
        // スロット自体に直接適用されている可能性のあるスタイルもリセット
        slotToClear.style.opacity = ''; 
        slotToClear.style.position = ''; 
        slotToClear.style.zIndex = ''; 
        slotToClear.style.transform = ''; 

        // イベントリスナーも削除（スロットが空になるため）
        slotToClear.removeEventListener("dragstart", handleDragStart);
        slotToClear.removeEventListener("touchstart", handleTouchStart);
        slotToClear.removeEventListener("touchmove", handleTouchMove);
        slotToClear.removeEventListener("touchend", handleTouchEnd);
        slotToClear.removeEventListener("touchcancel", handleTouchEnd);
        slotToClear.draggable = false; // ドラッグ不可に戻す
        
        // スロットに一時的に保存されていた元のアイテムデータもクリア
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
 * ドラッグ終了時の処理。
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグの際のクラス削除
  if (currentPcDraggedElement) {
    currentPcDraggedElement.classList.remove("dragging");
    console.log(`[finishDragging] Removed 'dragging' class from PC item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
  }

  // モバイルドラッグのクローン要素を確実に削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (clone) from body.");
  }
  currentTouchDraggedClone = null; // 確実にnullにする

  // 全てのスロットからドラッグ関連のクラスを削除
  setlist.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target', 'placeholder-slot');
    slot.style.opacity = '';
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // グローバル変数をすべて確実にリセット
  currentDropZone = null;
  activeTouchSlot = null;
  currentPcDraggedElement = null;
  draggingItemId = null; // ここでリセット
  isDragging = false;
  if (originalSetlistSlot && originalSetlistSlot._originalItemData) {
      delete originalSetlistSlot._originalItemData;
  }
  originalSetlistSlot = null;

  if (touchTimeout) { // 念のため、残っているタイマーをクリア
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }

  // **修正点**: ドラッグ終了時に、現在セットリストに存在するアイテムをアルバムメニューで非表示にする
  // これにより、ドロップが成功した場合、アルバム側のアイテムが常に非表示になる
  hideSetlistItemsInMenu();

  console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
}



/*------------------------------------------------------------------------------------------------------------*/


/**
 * アイテムを元のアルバムリストに戻し、セットリストから削除する。
 * @param {Element} elementToProcess - セットリストから戻す、または削除する対象の要素（元のセットリストスロット要素、またはモバイルのクローン要素）
 */
function restoreToOriginalList(elementToProcess) {
    // まず、対象のアイテムのIDを取得
    // elementToProcess が currentTouchDraggedClone の場合、dataset.itemId はすでに draggingItemId に設定されている
    const itemId = elementToProcess.dataset.itemId || draggingItemId; 
    let slotToClear = null;

    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found for restoration. Element:`, elementToProcess);
        // タッチドラッグで body 直下に作成されたクローン要素であれば削除
        if (elementToProcess === currentTouchDraggedClone && elementToProcess.parentNode === document.body) {
            elementToProcess.remove();
            console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body.");
        }
        return; 
    }

    // elementToProcessがセットリストのスロット自身か、スロット内の子要素かを判定し、クリアすべきスロットを特定
    if (elementToProcess.classList.contains('setlist-slot') && elementToProcess.classList.contains('setlist-item')) {
        slotToClear = elementToProcess;
    } else {
        // elementToProcessが.itemクラスの要素（例えばクローン要素）だった場合、元のスロットを探す
        // または、元々アルバムリストから来ていた場合はスロットは関係ない
        slotToClear = setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${itemId}"]`);
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}. Source element:`, elementToProcess);

    // アルバムリストの元のアイテムを表示に戻す
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.display = ''; // 表示に戻す
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // セットリストからスロットの内容をクリア（もしセットリストに存在していた場合）
    if (slotToClear) {
        console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotToClear.dataset.slotIndex}`);
        clearSlotContent(setlist, slotToClear.dataset.slotIndex); 
    } else {
        console.log(`[restoreToOriginalList] Item ${itemId} was not in setlist (or slot not found), no slot to clear.`);
    }
    
    // originalAlbumMapからエントリを削除（該当アイテムがセットリストから完全に削除されたため）
    if (originalAlbumMap.has(itemId)) {
        originalAlbumMap.delete(itemId);
        console.log(`[restoreToOriginalList] Deleted ${itemId} from originalAlbumMap.`);
    }

    // タッチドラッグで body 直下に作成されたクローン要素であれば削除
    if (elementToProcess === currentTouchDraggedClone && elementToProcess.parentNode === document.body) {
        elementToProcess.remove();
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
    finishDragging(); // アイテムが見つからない場合もクリーンアップ
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
    // アルバムリストのアイテムをダブルクリックした場合 (セットリストに追加)
    console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
    const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));
    
    if (!emptySlot) {
      showMessageBox('セットリストは最大曲数に達しています。');
      console.log("[handleDoubleClick] Setlist is full.");
      finishDragging(); // セットリストが満杯の場合もクリーンアップ
      return;
    }

    // セットリストに既に同じアイテムが存在しないか確認
    if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
      const originalList = item.parentNode;
      originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null); 
      console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);
      
      item.style.display = 'none'; // アルバムリストの元のアイテムを非表示にする
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
  // ダブルクリック処理が完了したら、必ず finishDragging を呼ぶ
  finishDragging(); 
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

        // 元のアルバムアイテムがショート属性を持つかどうかを取得
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
            
            // リセット処理をここに集約
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


/*------------------------------------------------------------------------------------------------------------*/


/**
 * セットリスト内のアイテムをアルバムメニューから非表示にする。
 * この関数は、loadSetlistStateの完了後、または通常読み込み時に呼び出される。
 */
function hideSetlistItemsInMenu() {
    const allAlbumItems = document.querySelectorAll('.album-content .item');
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");

    // まず、すべてのアルバムアイテムを一時的に表示状態に戻す（念のため）
    allAlbumItems.forEach(item => {
        item.style.display = '';
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
                albumItemInMenu.style.display = 'none';
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
 * 文字共有機能 (スロット対応版)
 */
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
    // ロード失敗時でもメニューアイテムの表示状態は調整する
    hideSetlistItemsInMenu(); 
  });
});