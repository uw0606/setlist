        // --- グローバル変数とヘルパー関数の定義 ---
        const setlist = document.getElementById('setlist');
        const menu = document.getElementById('menu');
        const menuButton = document.getElementById('menuButton');

        let originalAlbumMap = new Map();
        let isDragging = false;
        let draggingItemId = null;
        let originalSetlistSlot = null;
        let currentTouchDraggedClone = null;
        let currentPcDraggedElement = null;
        let currentDropZone = null;
        let activeTouchSlot = null;
        let lastTapTime = 0;
        let touchTimeout = null;
        let rafId = null;

        const maxSongs = 26;

        // 月に応じて日数を更新する関数 (グローバルスコープに移動)
        const updateDays = () => {
            const setlistYear = document.getElementById('setlistYear');
            const setlistMonth = document.getElementById('setlistMonth');
            const setlistDay = document.getElementById('setlistDay');

            if (!setlistYear || !setlistMonth || !setlistDay) {
                console.warn("[updateDays] Date select elements not found. Cannot update days.");
                return;
            }
            setlistDay.innerHTML = ''; // 現在の日オプションをクリア
            const year = parseInt(setlistYear.value);
            const month = parseInt(setlistMonth.value);
            
            // 選択された年と月の最終日を取得
            const daysInMonth = new Date(year, month, 0).getDate();

            for (let i = 1; i <= daysInMonth; i++) {
                const option = document.createElement('option');
                option.value = i.toString().padStart(2, '0'); // 1桁の場合は0でパディング
                option.textContent = i;
                setlistDay.appendChild(option);
            }
            console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}`);
        };


        /**
         * セットリストスロットの内容をクリアする
         */
        function clearSlotContent(setlistContainer, slotIndex) {
            const slot = setlistContainer.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
            if (slot) {
                slot.innerHTML = `<span class="slot-number">${parseInt(slotIndex) + 1}</span><div class="song-info-container"></div>`; // 初期状態に戻す
                slot.classList.remove('setlist-item', 'short', 'se-active', 'drumsolo-active', 'album1', 'album2', 'album3', 'placeholder-slot');
                delete slot.dataset.itemId;
                delete slot.dataset.songName;
                delete slot.dataset.rGt;
                delete slot.dataset.lGt;
                delete slot.dataset.bass;
                delete slot.dataset.bpm;
                delete slot.dataset.chorus;
                delete slot.dataset.isShortVersion;
                delete slot.dataset.hasSeOption;
                delete slot.dataset.seChecked;
                delete slot.dataset.hasDrumsoloOption;
                delete slot.dataset.drumsoloChecked;
                console.log(`[clearSlotContent] Slot ${slotIndex} cleared.`);
            }
        }

        /**
         * アイテムデータを取得するヘルパー関数
         */
        function getSlotItemData(element) {
            if (!element) return null;

            let itemElement = element;
            // .item-displayを持つセットリスト内の曲の場合、その子要素からデータを取得
            if (element.classList.contains('setlist-slot')) {
                itemElement = element.querySelector('.song-info-container > div.item-display');
                // もし.item-displayが見つからなくても、スロット自体にdatasetがある場合がある（ロードされた状態など）
                if (!itemElement) {
                    if (element.dataset.itemId) { // スロット自体にデータがあればそれを使う
                         return {
                            name: element.dataset.songName || '',
                            itemId: element.dataset.itemId,
                            rGt: element.dataset.rGt || '',
                            lGt: element.dataset.lGt || '',
                            bass: element.dataset.bass || '',
                            bpm: element.dataset.bpm || '',
                            chorus: element.dataset.chorus || '',
                            short: element.dataset.short === 'true', // dataset.short を参照
                            seChecked: element.dataset.seChecked === 'true',
                            drumsoloChecked: element.dataset.drumsoloChecked === 'true',
                            hasShortOption: element.dataset.isShortVersion === 'true', // hasShortOptionはisShortVersionで判断
                            hasSeOption: element.dataset.hasSeOption === 'true',
                            hasDrumsoloOption: element.dataset.hasDrumsoloOption === 'true',
                            slotIndex: element.dataset.slotIndex,
                            albumClass: Array.from(element.classList).find(cls => cls.startsWith('album')) || null
                        };
                    }
                    console.warn("[getSlotItemData] Element is a setlist-slot but has no .item-display or dataset.itemId:", element);
                    return null;
                }
            }

            // .item-displayまたはアルバムリストの.item要素の場合
            if (!itemElement.dataset.itemId) {
                console.warn("[getSlotItemData] Element has no itemId (or .item-display not found/has no itemId):", itemElement);
                return null;
            }

            return {
                name: itemElement.dataset.songName || itemElement.textContent.trim(),
                itemId: itemElement.dataset.itemId,
                rGt: itemElement.dataset.rGt || '',
                lGt: itemElement.dataset.lGt || '',
                bass: itemElement.dataset.bass || '',
                bpm: itemElement.dataset.bpm || '',
                chorus: itemElement.dataset.chorus || '',
                short: itemElement.dataset.short === 'true', // .item-displayまたはアルバムアイテムから直接取得
                seChecked: itemElement.dataset.seChecked === 'true',
                drumsoloChecked: itemElement.dataset.drumsoloChecked === 'true',
                hasShortOption: itemElement.dataset.isShortVersion === 'true',
                hasSeOption: itemElement.dataset.hasSeOption === 'true',
                hasDrumsoloOption: itemElement.dataset.hasDrumsoloOption === 'true',
                slotIndex: element.classList.contains('setlist-slot') ? element.dataset.slotIndex : undefined,
                albumClass: Array.from(itemElement.classList).find(cls => cls.startsWith('album')) || null
            };
        }

        /**
         * オプションチェックボックスを作成するヘルパー関数
         */
        function createOptionCheckbox(labelText, optionType, isChecked) {
            const label = document.createElement('label');
            label.classList.add('option-label');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.optionType = optionType;
            checkbox.checked = isChecked;

            const span = document.createElement('span');
            span.textContent = labelText;
            span.classList.add('option-text');

            label.appendChild(checkbox);
            label.appendChild(span);
            return label;
        }

        /**
         * セットリストのスロットをアイテムデータで埋める
         */
        function fillSlotWithItem(slotElement, itemData) {
            console.log("[fillSlotWithItem] Filling slot:", slotElement.dataset.slotIndex, "with data:", itemData);

            const songInfoContainer = slotElement.querySelector('.song-info-container');
            if (!songInfoContainer) {
                console.error("song-info-container not found in slot:", slotElement);
                return;
            }
            songInfoContainer.innerHTML = '';

            const itemDisplayDiv = document.createElement('div');
            itemDisplayDiv.classList.add('item-display');
            itemDisplayDiv.textContent = itemData.name;

            // itemDisplayDivにデータを設定 (今後の参照のために重要)
            itemDisplayDiv.dataset.itemId = itemData.itemId;
            itemDisplayDiv.dataset.songName = itemData.name;
            itemDisplayDiv.dataset.rGt = itemData.rGt || '';
            itemDisplayDiv.dataset.lGt = itemData.lGt || '';
            itemDisplayDiv.dataset.bass = itemData.bass || '';
            itemDisplayDiv.dataset.bpm = itemData.bpm || '';
            itemDisplayDiv.dataset.chorus = itemData.chorus || '';
            
            // オプションの有無と現在の状態 (itemDisplayDivにも設定)
            itemDisplayDiv.dataset.isShortVersion = itemData.hasShortOption ? 'true' : 'false';
            itemDisplayDiv.dataset.hasSeOption = itemData.hasSeOption ? 'true' : 'false';
            itemDisplayDiv.dataset.hasDrumsoloOption = itemData.hasDrumsoloOption ? 'true' : 'false';
            itemDisplayDiv.dataset.short = itemData.short ? 'true' : 'false';
            itemDisplayDiv.dataset.seChecked = itemData.seChecked ? 'true' : 'false';
            itemDisplayDiv.dataset.drumsoloChecked = itemData.drumsoloChecked ? 'true' : 'false';


            slotElement.classList.add('setlist-item');
            // 既存のアルバムクラスを削除してから追加
            slotElement.classList.remove('album1', 'album2', 'album3'); 
            if (itemData.albumClass) {
                slotElement.classList.add(itemData.albumClass);
            }
            
            slotElement.classList.toggle('short', itemData.short);
            slotElement.dataset.short = itemData.short ? 'true' : 'false';
            
            slotElement.classList.toggle('se-active', itemData.seChecked);
            slotElement.dataset.seChecked = itemData.seChecked ? 'true' : 'false';
            
            slotElement.classList.toggle('drumsolo-active', itemData.drumsoloChecked);
            slotElement.dataset.drumsoloChecked = itemData.drumsoloChecked ? 'true' : 'false';

            // スロット要素自体にもデータを設定 (getSlotItemDataで直接スロットから取得できるようにするため)
            slotElement.dataset.itemId = itemData.itemId;
            slotElement.dataset.songName = itemData.name;
            slotElement.dataset.rGt = itemData.rGt || '';
            slotElement.dataset.lGt = itemData.lGt || '';
            slotElement.dataset.bass = itemData.bass || '';
            slotElement.dataset.bpm = itemData.bpm || '';
            slotElement.dataset.chorus = itemData.chorus || '';
            slotElement.dataset.isShortVersion = itemData.hasShortOption ? 'true' : 'false';
            slotElement.dataset.hasSeOption = itemData.hasSeOption ? 'true' : 'false';
            slotElement.dataset.hasDrumsoloOption = itemData.hasDrumsoloOption ? 'true' : 'false';

            songInfoContainer.appendChild(itemDisplayDiv);

            // オプションチェックボックスを追加
            if (itemData.hasShortOption) {
                songInfoContainer.appendChild(createOptionCheckbox('Short', 'short', itemData.short));
            }
            if (itemData.hasSeOption) {
                songInfoContainer.appendChild(createOptionCheckbox('SE', 'se', itemData.seChecked));
            }
            if (itemData.hasDrumsoloOption) {
                songInfoContainer.appendChild(createOptionCheckbox('Dr.Solo', 'drumsolo', itemData.drumsoloChecked));
            }
        }

        /**
         * ドラッグ終了時のクリーンアップ（共通処理）
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

            if (originalSetlistSlot && originalSetlistSlot.classList.contains('placeholder-slot')) {
                originalSetlistSlot.classList.remove('placeholder-slot');
                if (originalSetlistSlot.classList.contains('setlist-item')) {
                    originalSetlistSlot.style.visibility = '';
                    console.log(`[finishDragging] Restored visibility for originalSetlistSlot (still has item): ${originalSetlistSlot.dataset.slotIndex}.`);
                } else {
                    originalSetlistSlot.style.visibility = '';
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
        }

        /**
         * セットリストにある曲をアルバムメニューで非表示にする
         */
        function hideSetlistItemsInMenu() {
            console.log("[hideSetlistItemsInMenu] Checking and hiding setlist items in menu.");
            // まずすべてのアルバムアイテムを表示状態に戻す
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.visibility = '';
            });

            // 現在セットリストにあるアイテムを非表示にする
            setlist.querySelectorAll('.setlist-slot.setlist-item').forEach(setlistItemSlot => {
                const itemId = setlistItemSlot.dataset.itemId;
                if (itemId) {
                    const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
                    if (albumItem) {
                        albumItem.style.visibility = 'hidden';
                        console.log(`[hideSetlistItemsInMenu] Hid album item: ${itemId}`);
                    }
                }
            });
        }

        /**
         * メッセージボックスを表示する（簡易版）
         */
        function showMessageBox(message) {
            const messageBox = document.getElementById('messageBox');
            if (messageBox) {
                messageBox.textContent = message;
                messageBox.style.display = 'block';
                setTimeout(() => {
                    messageBox.style.display = 'none';
                }, 3000);
            } else {
                console.log("[MessageBox]:", message);
            }
        }

        /**
         * ドラッグ開始時の処理 (PC)
         */
        function handleDragStart(event) {
            console.log("[handleDragStart] Drag started.");
            const draggedElement = event.target.closest('.item') || event.target.closest('.setlist-slot.setlist-item');
            if (!draggedElement) {
                event.preventDefault();
                return;
            }

            isDragging = true;
            draggingItemId = draggedElement.dataset.itemId;
            currentPcDraggedElement = draggedElement;

            event.dataTransfer.setData("text/plain", draggingItemId);
            event.dataTransfer.effectAllowed = "move";

            if (setlist.contains(draggedElement) && draggedElement.classList.contains('setlist-item')) {
                originalSetlistSlot = draggedElement;
                originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
                console.log(`[handleDragStart] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
                draggedElement.classList.add('dragging');
                draggedElement.style.visibility = 'hidden';
            } else {
                originalSetlistSlot = null; // アルバムからのドラッグ
                draggedElement.style.visibility = 'hidden'; // アルバムアイテムも一旦非表示にする
            }
            console.log(`[handleDragStart] draggedItemId: ${draggingItemId}, isDragging: ${isDragging}`);
        }

        /**
         * ドラッグオーバー時の処理 (ドロップターゲットの上をドラッグ中)
         */
        function handleDragOver(event) {
            event.preventDefault();
            if (isDragging) {
                event.dataTransfer.dropEffect = "move";
                const dropTargetSlot = event.target.closest('.setlist-slot');
                if (dropTargetSlot) {
                    if (dropTargetSlot !== currentDropZone) {
                        if (currentDropZone) currentDropZone.classList.remove('drag-over');
                        dropTargetSlot.classList.add('drag-over');
                        currentDropZone = dropTargetSlot;
                    }
                } else {
                    if (currentDropZone) currentDropZone.classList.remove('drag-over');
                    currentDropZone = null;
                }
            }
        }

        /**
         * ドラッグエンター時の処理
         */
        function handleDragEnter(event) {
            event.preventDefault();
            if (isDragging) {
                const dropTargetSlot = event.target.closest('.setlist-slot');
                if (dropTargetSlot) {
                    dropTargetSlot.classList.add('active-drop-target');
                }
            }
        }

        /**
         * ドラッグリーブ時の処理
         */
        function handleDragLeave(event) {
            const dropTargetSlot = event.target.closest('.setlist-slot');
            if (dropTargetSlot) {
                dropTargetSlot.classList.remove('drag-over', 'active-drop-target');
            }
        }

        /**
         * ドロップ処理（PC/モバイル共通のコアロジック）
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
                // アルバムアイテムからのドラッグの場合、getSlotItemDataで必要な情報を補完
                draggedItemData = getSlotItemData(draggedElement);
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
                    console.log("[processDrop] Dropped setlist item outside setlist. Restoring to original list.");
                    clearSlotContent(setlist, originalSetlistSlot.dataset.slotIndex);
                    restoreToOriginalList(draggedElement);
                }
            } else { // アルバムからドラッグされた場合
                if (dropTargetSlot) {
                    if (dropTargetSlot.classList.contains('setlist-item')) {
                        showMessageBox('このスロットはすでに埋まっています。');
                        restoreToOriginalList(draggedElement); // アルバムのアイテムを再表示
                        return;
                    }

                    const currentSongCount = Array.from(setlist.children).filter(slot => slot.classList.contains('setlist-item')).length;
                    if (currentSongCount >= maxSongs) {
                        showMessageBox('セットリストは最大曲数に達しています。');
                        restoreToOriginalList(draggedElement); // アルバムのアイテムを再表示
                        return;
                    }
                    
                    // スロットのインデックスをitemDataに追加して保存
                    draggedItemData.slotIndex = dropTargetSlot.dataset.slotIndex;

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

        /**
         * ドロップ時の処理（PC）
         */
        function handleDrop(event) {
            event.preventDefault();
            console.log("[handleDrop] Drop event fired.");
            const droppedItemId = event.dataTransfer.getData("text/plain");
            console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

            let draggedItem;
            // ドラッグ元がセットリスト内だった場合
            if (originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId) {
                draggedItem = originalSetlistSlot;
                console.log("[handleDrop] Using originalSetlistSlot as draggedItem.");
            } else {
                // ドラッグ元がアルバムリストだった場合
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

            processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);

            finishDragging();
        }

        /**
         * タッチ開始時の処理 (モバイル)
         */
        function handleTouchStart(event) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;

            const closestCheckbox = event.target.closest('input[type="checkbox"]');
            const isCheckboxClick = closestCheckbox !== null;

            if (isCheckboxClick) {
                console.log("[touchstart:Mobile] Checkbox clicked directly. Allowing native behavior.");
                lastTapTime = 0; // ダブルタップ検出を防ぐ
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    touchTimeout = null;
                }
                isDragging = false; // ドラッグ状態にしない
                return;
            }

            // ダブルタップ検出ロジック
            if (tapLength < 300 && tapLength > 0) { // 300ms以内に2回目のタップ
                event.preventDefault(); // デフォルトのイベントを防ぐ（ズームなど）
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    touchTimeout = null;
                }
                handleDoubleClick(event);
                lastTapTime = 0; // 次のダブルタップのためにリセット
                console.log("[touchstart] Double tap detected. Handled by handleDoubleClick.");
                return;
            }
            lastTapTime = currentTime;

            if (event.touches.length === 1) { // シングルタッチのみを処理
                const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
                if (!touchedElement) {
                    console.warn("[touchstart:Mobile] No draggable item found on touch start.");
                    return;
                }
                console.log("[touchstart:Mobile] Touched element (non-checkbox):", touchedElement);
                console.log("[touchstart:Mobile] Touched element itemId:", touchedElement.dataset.itemId);

                isDragging = false; // 初期状態ではドラッグではない
                draggingItemId = touchedElement.dataset.itemId;

                if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
                    originalSetlistSlot = touchedElement;
                    originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot); // 元のスロットデータを保存
                    console.log(`[touchstart:Mobile] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
                } else {
                    originalSetlistSlot = null; // アルバムからのドラッグ
                }

                // タッチ開始位置を記録
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY; // typo修正

                // 長押し判定のためのタイマー設定
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    touchTimeout = null;
                }
                touchTimeout = setTimeout(() => {
                    // タイマーが終了した時点でまだドラッグ開始していなければ、ドラッグを開始
                    if (!isDragging && draggingItemId && document.body.contains(touchedElement)) {
                        event.preventDefault(); // 長押しでドラッグ開始するため、デフォルトの動作を防ぐ
                        createTouchDraggedClone(touchedElement, touchStartX, touchStartY, draggingItemId);
                        isDragging = true; // ドラッグ開始
                    } else {
                        console.warn("[touchstart:Mobile] Dragging not initiated after timeout.");
                    }
                    touchTimeout = null; // タイマーをクリア
                }, 600); // 600ms以上の長押しでドラッグ開始
            }
        }

        /**
         * タッチ移動時の処理 (モバイル)
         */
        function handleTouchMove(event) {
            if (!isDragging || !currentTouchDraggedClone) return; // ドラッグ中でないか、クローンがなければ何もしない

            event.preventDefault(); // ページのスクロールなどのデフォルト動作を防ぐ

            if (rafId !== null) { // 既存のAnimationFrameがあればキャンセル
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                if (!currentTouchDraggedClone) { // クローンが消えていたら何もしない
                    rafId = null;
                    return;
                }
                const touch = event.touches[0];
                const newX = touch.clientX;
                const newY = touch.clientY;

                // クローン要素の位置を更新
                const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
                currentTouchDraggedClone.style.left = (newX - cloneRect.width / 2) + 'px';
                currentTouchDraggedClone.style.top = (newY - cloneRect.height / 2) + 'px';

                // ドロップターゲットの検出
                const targetElement = document.elementFromPoint(newX, newY);
                const newDropZone = targetElement ? targetElement.closest('.setlist-slot') : null;

                // ドラッグ元スロットへの重ね合わせを無視（見た目上の挙動）
                if (originalSetlistSlot && newDropZone && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
                    if (currentDropZone) {
                        currentDropZone.classList.remove('drag-over');
                    }
                    currentDropZone = null;
                    rafId = null; // スロットに戻っている場合はドラッグオーバー表示をクリア
                    return;
                }

                // ドロップゾーンの更新と視覚的なフィードバック
                if (newDropZone !== currentDropZone) {
                    if (currentDropZone) currentDropZone.classList.remove('drag-over');
                    if (newDropZone) newDropZone.classList.add('drag-over');
                    currentDropZone = newDropZone;
                }

                rafId = null; // RequestAnimationFrame IDをリセット
            });
        }

        /**
         * タッチ終了時の処理 (モバイル)
         */
        function handleTouchEnd(event) {
            const closestCheckbox = event.target.closest('input[type="checkbox"]');
            const isCheckboxClick = closestCheckbox !== null;

            // 長押しタイマーがあればクリア
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }

            // ドラッグ中でなければ（ただのタップなど）、処理を終了
            if (!isDragging) {
                if (!isCheckboxClick) { // チェックボックスクリックでなければログを出す
                    console.log("[touchend] Not dragging, not a checkbox click. Allowing default behaviors.");
                } else { // チェックボックスクリックの場合はfinishDraggingは不要
                    console.log("[touchend] Not dragging, but it's a checkbox click. Skipping finishDragging.");
                }
                return;
            }

            console.log("[touchend] event fired. isDragging:", isDragging);

            if (!currentTouchDraggedClone) {
                console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
                finishDragging(); // クリーンアップ
                return;
            }

            // すべてのdrag-overクラスを削除
            document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));

            const touch = event.changedTouches[0];
            // ドロップされた位置の要素を取得し、セットリストスロットを探す
            const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
            const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
            console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none");

            // ドロップ処理を実行
            processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);

            // ドラッグ状態を終了し、クリーンアップ
            finishDragging();
        }

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

            // 元の要素のクラス（ショート、SE、ドラムソロ、アルバムクラスなど）をクローンにコピー
            if (originalElement.classList.contains('short')) {
                currentTouchDraggedClone.classList.add('short');
            }
            if (originalElement.classList.contains('se-active')) {
                currentTouchDraggedClone.classList.add('se-active');
            }
            if (originalElement.classList.contains('drumsolo-active')) {
                currentTouchDraggedClone.classList.add('drumsolo-active');
            }
            Array.from(originalElement.classList).forEach(cls => {
                if (cls.startsWith('album')) {
                    currentTouchDraggedClone.classList.add(cls);
                }
            });

            // 元の要素のdata-属性をクローンにコピー
            for (const key in originalElement.dataset) {
                currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
            }
            currentTouchDraggedClone.dataset.itemId = itemIdToClone; // itemIdを確実に設定

            document.body.appendChild(currentTouchDraggedClone);

            // 元の要素がセットリストスロットの場合
            if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
                originalSetlistSlot = originalElement;
                const originalItemData = getSlotItemData(originalElement);
                if (originalItemData) {
                    originalSetlistSlot._originalItemData = originalItemData; // 元のスロットデータを保存
                    console.log(`[createTouchDraggedClone] _originalItemData stored for slot ${originalSetlistSlot.dataset.slotIndex}`, originalItemData);
                }
                originalSetlistSlot.classList.add('placeholder-slot'); // プレースホルダーとしてマーク
                originalElement.style.visibility = 'hidden'; // 元の要素を非表示に
                console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
            } else { // 元の要素がアルバムアイテムの場合
                originalElement.style.visibility = 'hidden'; // 元のアルバムアイテムを非表示に
                originalSetlistSlot = null; // アルバムからのドラッグなので元のスロットはない
                console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
            }

            // originalAlbumMapに元のリストを記録 (アルバムからドラッグした場合のみ)
            if (!originalAlbumMap.has(itemIdToClone)) {
                const originalList = originalElement.closest('.album-content'); // 親のアルバムコンテンツIDを取得
                const originalListId = originalList ? originalList.id : null;
                originalAlbumMap.set(itemIdToClone, originalListId);
            }

            // クローンの位置とスタイルを設定
            const rect = originalElement.getBoundingClientRect();
            currentTouchDraggedClone.style.position = 'fixed';
            currentTouchDraggedClone.style.zIndex = '10000';
            currentTouchDraggedClone.style.width = rect.width + 'px';
            currentTouchDraggedClone.style.height = rect.height + 'px';
            currentTouchDraggedClone.style.left = initialX - rect.width / 2 + 'px';
            currentTouchDraggedClone.style.top = initialY - rect.height / 2 + 'px';
            currentTouchDraggedClone.style.pointerEvents = 'none'; // クローンがイベントをブロックしないように

            console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
        }

        /**
         * アイテムを元のリスト（アルバム）に戻す
         */
        function restoreToOriginalList(draggedElement) {
            const itemId = draggedElement.dataset.itemId || (currentPcDraggedElement ? currentPcDraggedElement.dataset.itemId : null) || (currentTouchDraggedClone ? currentTouchDraggedClone.dataset.itemId : null);
            if (!itemId) {
                console.error("[restoreToOriginalList] No itemId found for draggedElement.");
                return;
            }

            console.log(`[restoreToOriginalList] Restoring item ${itemId} to original list.`);

            const albumItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);

            if (albumItem) {
                albumItem.style.visibility = ''; // アルバムアイテムを再表示
                console.log(`[restoreToOriginalList] Album item ${itemId} made visible.`);
            } else if (draggedElement.classList.contains('setlist-item')) {
                // セットリスト内のアイテムがアルバムに存在しない場合 (例: text slot)
                console.warn(`[restoreToOriginalList] Album item for ${itemId} not found in album-content. Cannot restore visually.`);
            }
        }

        /**
         * ダブルクリック（ダブルタップ）時の処理。
         */
        function handleDoubleClick(event) {
            const item = event.target.closest(".item") || event.target.closest(".setlist-slot.setlist-item");
            if (!item) {
                console.log("[handleDoubleClick] No item found for double click.");
                finishDragging(); // クリーンアップ
                return;
            }

            event.preventDefault(); // デフォルトの選択動作などを防ぐ
            event.stopPropagation(); // イベントのバブリングを停止
            console.log(`[handleDoubleClick] Double click on item ID: ${item.dataset.itemId || 'N/A'}`);

            const isInsideSetlist = setlist.contains(item) && item.classList.contains('setlist-item');

            if (isInsideSetlist) {
                console.log("[handleDoubleClick] Item is in setlist. Restoring to original list.");
                const itemIdToClear = item.dataset.itemId;
                const slotIndexToClear = item.dataset.slotIndex;

                clearSlotContent(setlist, slotIndexToClear); // スロットをクリア
                restoreToOriginalList(item); // 元のリストに戻す
            } else {
                console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
                const emptySlot = Array.from(setlist.children).find(slot => !slot.classList.contains('setlist-item'));

                if (!emptySlot) {
                    showMessageBox('セットリストは最大曲数に達しています。');
                    console.log("[handleDoubleClick] Setlist is full.");
                    finishDragging(); // クリーンアップ
                    return;
                }

                // セットリストに同じ曲がすでにないか確認
                if (!setlist.querySelector(`.setlist-slot.setlist-item[data-item-id="${item.dataset.itemId}"]`)) {
                    // originalAlbumMapに元のリストを記録
                    const originalList = item.closest('.album-content');
                    originalAlbumMap.set(item.dataset.itemId, originalList ? originalList.id : null);
                    console.log(`[handleDoubleClick] Original list for ${item.dataset.itemId} set to: ${originalList ? originalList.id : 'null'}`);

                    item.style.visibility = 'hidden'; // アルバムメニューから非表示に
                    console.log(`[handleDoubleClick] Hiding original album item: ${item.dataset.itemId}`);

                    const itemData = getSlotItemData(item);
                    if (itemData) {
                        // データに不足しているオプションの有無情報を補完
                        itemData.hasShortOption = item.dataset.isShortVersion === 'true';
                        itemData.hasSeOption = item.dataset.hasSeOption === 'true';
                        itemData.hasDrumsoloOption = item.dataset.hasDrumsoloOption === 'true';
                        itemData.short = item.dataset.short === 'true';
                        itemData.seChecked = item.dataset.seChecked === 'true';
                        itemData.drumsoloChecked = item.dataset.drumsoloChecked === 'true';

                        fillSlotWithItem(emptySlot, itemData); // 空きスロットに曲を追加
                        console.log(`[handleDoubleClick] Item ${item.dataset.itemId} added to slot ${emptySlot.dataset.slotIndex}`);
                    } else {
                        console.error("[handleDoubleClick] Failed to get item data for double clicked album item.");
                    }
                } else {
                    console.log(`[handleDoubleClick] Item ${item.dataset.itemId} already in setlist. Doing nothing.`);
                }
            }
            finishDragging(); // クリーンアップ
        }
        document.addEventListener("dblclick", handleDoubleClick); // 全体でダブルクリックイベントをリッスン

        /**
         * ドラッグ＆ドロップを有効にする関数。
         */
        function enableDragAndDrop(element) {
            if (element.classList.contains('item')) { // アルバムアイテムの場合
                // itemIdがなければ自動生成 (必須)
                if (!element.dataset.itemId) {
                    element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                }
                // songNameがなければtextContentから取得 (必須)
                if (!element.dataset.songName) {
                    element.dataset.songName = element.textContent.trim();
                }
                element.draggable = true; // ドラッグ可能にする

                element.addEventListener("dragstart", handleDragStart);

                element.addEventListener("touchstart", handleTouchStart, { passive: false }); // 長押しドラッグのためにpassive: false
                element.addEventListener("touchmove", handleTouchMove, { passive: false });
                element.addEventListener("touchend", handleTouchEnd);
                element.addEventListener("touchcancel", handleTouchEnd); // タッチキャンセル時も終了処理
            } else if (element.classList.contains('setlist-slot')) { // セットリストスロットの場合
                element.addEventListener("dragover", handleDragOver);
                element.addEventListener("drop", handleDrop);
                element.addEventListener("dragenter", handleDragEnter);
                element.addEventListener("dragleave", handleDragLeave);
            }
        }

        document.addEventListener("dragend", finishDragging); // ドラッグ終了時のグローバルイベントリスナー


        // --- UI操作関数と状態管理 ---

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

                    // Album 1のitemIdリスト
                    const album1ItemIds = [
                        'album1-001', 'album1-002', 'album1-003', 'album1-004', 'album1-005', 
                        'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010', 
                        'album1-011', 'album1-012', 'album1-013'
                    ];

                    let songListText = "";
                    let itemNo = 1;

                    const setlistSlotsForShare = document.querySelectorAll("#setlist .setlist-slot");

                    if (setlistSlotsForShare.length > 0) {
                        songListText = Array.from(setlistSlotsForShare).map(slot => {
                            if (slot.classList.contains('setlist-item')) {
                                const songData = getSlotItemData(slot);
                                if (!songData) { // データが取得できない場合はスキップ
                                    console.warn(`Skipping slot ${slot.dataset.slotIndex} due to missing song data.`);
                                    return '';
                                }

                                let titleText = songData.name || '';

                                // オプション情報を追加
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

                                let line = '';
                                if (isAlbum1) {
                                    line = `    ${titleText}`; // インデント
                                } else {
                                    line = `${itemNo}. ${titleText}`;
                                    itemNo++;
                                }
                                return line;
                            } else if (slot.classList.contains('setlist-slot-text')) {
                                // テキストスロットの場合 (もしあれば)
                                const textContent = slot.textContent.trim();
                                if (textContent) {
                                    return textContent;
                                }
                            }
                            return '';
                        }).filter(line => line !== '').join("\n"); // 空行を除去して結合
                    }

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

                    // Web Share APIを使用できるか確認
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
                                if (error.name !== 'AbortError') { // ユーザーがキャンセルした場合はエラーとしない
                                    showMessageBox('共有に失敗しました。');
                                }
                            });
                    } else {
                        // Web Share APIが使えない場合、リンクをクリップボードにコピー
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

        /**
         * 現在のセットリストとUIの状態を取得する
         */
        function getCurrentState() {
            const setlistItems = [];
            setlist.querySelectorAll('.setlist-slot.setlist-item').forEach((slot) => {
                const itemData = getSlotItemData(slot);
                if (itemData) {
                    setlistItems.push(itemData);
                }
            });

            const openAlbums = [];
            document.querySelectorAll('.album-content.active').forEach(album => {
                openAlbums.push(album.id);
            });

            const setlistYear = document.getElementById('setlistYear')?.value;
            const setlistMonth = document.getElementById('setlistMonth')?.value;
            const setlistDay = document.getElementById('setlistDay')?.value;
            const setlistDate = (setlistYear && setlistMonth && setlistDay) ? `${setlistYear}-${setlistMonth}-${setlistDay}` : '';
            const setlistVenue = document.getElementById('setlistVenue')?.value || '';

            return {
                setlist: setlistItems,
                setlistDate: setlistDate,
                setlistVenue: setlistVenue,
                menuOpen: menu.classList.contains('open'),
                openAlbums: openAlbums,
                originalAlbumMap: Object.fromEntries(originalAlbumMap)
            };
        }

        /**
         * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
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

                                // 既存のセットリストとアルバムメニューを初期化
                                for (let i = 0; i < maxSongs; i++) {
                                    clearSlotContent(setlist, i.toString());
                                }
                                document.querySelectorAll('.album-content .item').forEach(item => {
                                    item.style.visibility = ''; // すべてのアルバムアイテムを表示状態に戻す
                                });
                                originalAlbumMap.clear(); // マップをクリア
                                console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

                                // originalAlbumMapを復元
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

                                // 日付と会場を復元
                                if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                                    const dateParts = state.setlistDate.split('-');
                                    if (dateParts.length === 3) {
                                        setlistYear.value = dateParts[0];
                                        setlistMonth.value = dateParts[1];

                                        updateDays(); // 日数を更新
                                        setlistDay.value = dateParts[2];
                                        console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                                    } else {
                                        console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                                    }
                                } else {
                                    console.log("[loadSetlistState] No date to restore or date select elements not found. Initializing to default.");
                                    // 共有IDがない場合のデフォルト値と同じにする
                                    if (setlistYear) setlistYear.value = '2025';
                                    if (setlistMonth) setlistMonth.value = '01';
                                    updateDays(); // 日数を更新
                                    if (setlistDay) setlistDay.value = '01';
                                }
                                if (setlistVenue) {
                                    setlistVenue.value = state.setlistVenue || '東京ドーム'; // 会場もデフォルト値
                                    console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
                                } else {
                                    console.warn("[loadSetlistState] Venue input element not found.");
                                }

                                // セットリストのアイテムを復元
                                state.setlist.forEach(itemData => {
                                    const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
                                    if (targetSlot) {
                                        console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                                        fillSlotWithItem(targetSlot, itemData);
                                    } else {
                                        console.warn(`[loadSetlistState] Target slot not found for index: ${itemData.slotIndex}`);
                                    }
                                });

                                // メニューとアルバムの開閉状態を復元
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
                                resolve(); // 見つからなくてもエラーではないので解決
                            }
                        })
                        .catch((error) => {
                            console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
                            showMessageBox('セットリストのロードに失敗しました。');
                            reject(error);
                        });
                } else {
                    console.log("[loadSetlistState] No shareId found in URL. Loading default state (2025/01/01 東京ドーム).");
                    const setlistYear = document.getElementById('setlistYear');
                    const setlistMonth = document.getElementById('setlistMonth');
                    const setlistDay = document.getElementById('setlistDay');
                    const setlistVenue = document.getElementById('setlistVenue'); // 会場要素も取得

                    if (setlistYear && setlistMonth && setlistDay) {
                        setlistYear.value = '2025';
                        setlistMonth.value = '01';
                        updateDays(); // 日数を更新
                        setlistDay.value = '01';
                        console.log(`[loadSetlistState] Initialized date to 2025-01-01.`);
                    } else {
                        console.warn("[DOMContentLoaded] Date select elements (year, month, day) not fully found. Skipping auto-set date.");
                    }
                    if (setlistVenue) {
                        setlistVenue.value = '東京ドーム';
                        console.log(`[loadSetlistState] Initialized venue to 東京ドーム.`);
                    } else {
                        console.warn("[DOMContentLoaded] Venue input element not found. Skipping auto-set venue.");
                    }
                    resolve();
                }
            });
        }


        /**
         * セットリストのPDFを生成し、共有またはダウンロードする。
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
            const simplePdfBody = []; // シンプルPDF用 (曲名のみ)
            const setlistSlotsForPdf = document.querySelectorAll("#setlist .setlist-slot");

            let currentItemNo = 1; // 詳細PDFの通し番号
            let simpleItemNo = 1; // シンプルPDFの通し番号

            // Album 1のitemIdリスト (UVERworldの曲を想定)
            const album1ItemIds = [
                'album1-001', 'album1-002', 'album1-003', 'album1-004', 'album1-005', 
                'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010', 
                'album1-011', 'album1-012', 'album1-013'
            ];

            let shareableTextContent = ''; // 共有用のテキストコンテンツ
            let shareableTextItemNo = 1; // 共有用テキストの通し番号

            if (headerText) {
                shareableTextContent += `${headerText}\n\n`;
            }

            for (const slot of setlistSlotsForPdf) {
                if (slot.classList.contains('setlist-item')) {
                    const songData = getSlotItemData(slot);
                    if (songData) {
                        let titleText = songData.name || '';
                        // オプション情報を追加
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

                        let detailedItemNo = '';
                        if (!isAlbum1) { // Album 1以外の曲にのみ番号を振る
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

                        // シンプルPDF用のテキスト
                        if (isAlbum1) {
                            simplePdfBody.push(`    ${titleText}`);
                        } else {
                            simplePdfBody.push(`${simpleItemNo}. ${titleText}`);
                            simpleItemNo++;
                        }

                        // 共有用テキストの整形
                        if (isAlbum1) {
                            shareableTextContent += `    ${titleText}\n`;
                        } else {
                            shareableTextContent += `${shareableTextItemNo}. ${titleText}\n`;
                            shareableTextItemNo++;
                        }
                    }
                } else if (slot.classList.contains('setlist-slot-text')) {
                    // テキストスロットの場合（もしあれば）
                    const textContent = slot.textContent.trim();
                    if (textContent) {
                        tableBody.push([textContent, '', '', '', '', '', '']); // 詳細PDFではテキストのみ表示
                        simplePdfBody.push(textContent); // シンプルPDFにも追加
                        shareableTextContent += `${textContent}\n`; // 共有テキストにも追加
                    }
                }
            }

            console.log("[generateSetlistPdf] Generated Shareable Text:\n", shareableTextContent);

            try {
                const { jsPDF } = window.jspdf;
                // registerJapaneseFont関数が存在するか確認し、なければ警告
                if (typeof registerJapaneseFont === 'undefined') {
                    window.registerJapaneseFont = (doc) => {
                        console.warn("registerJapaneseFont function not found. PDF might not display Japanese characters correctly.");
                    };
                }

                // --- 詳細PDFの生成 ---
                const detailedPdf = new jsPDF('p', 'mm', 'a4');
                registerJapaneseFont(detailedPdf); // 日本語フォント登録

                const headerCellHeight = 10;
                const topMargin = 20;
                const leftMargin = 10;
                const pageWidth = detailedPdf.internal.pageSize.getWidth();
                const tableWidth = pageWidth - (leftMargin * 2);

                let detailedYPos = topMargin;

                // ヘッダー情報 (日付と会場) をPDF上部に表示
                if (headerText) {
                    detailedPdf.setFillColor(220, 220, 220); // 背景色
                    detailedPdf.setDrawColor(0, 0, 0); // 枠線の色
                    detailedPdf.setLineWidth(0.3); // 枠線の太さ
                    detailedPdf.rect(leftMargin, detailedYPos, tableWidth, headerCellHeight, 'FD'); // ヘッダーボックスを描画

                    detailedPdf.setFontSize(14);
                    detailedPdf.setFont('NotoSansJP', 'bold');
                    detailedPdf.setTextColor(0, 0, 0);
                    detailedPdf.text(headerText, pageWidth / 2, detailedYPos + headerCellHeight / 2 + 0.5, { align: 'center', baseline: 'middle' });

                    detailedYPos += headerCellHeight; // テーブル開始位置を更新
                }

                // autoTableプラグインを使用してテーブルを生成
                detailedPdf.autoTable({
                    head: [tableHeaders], // テーブルヘッダー
                    body: tableBody, // テーブルデータ
                    startY: detailedYPos, // テーブルの開始Y座標
                    theme: 'grid', // テーブルのテーマ (罫線あり)
                    styles: {
                        font: 'NotoSansJP',
                        fontStyle: 'normal',
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
                        halign: 'center' // ヘッダーセル中央揃え
                    },
                    columnStyles: { // カラムごとのスタイル設定
                        0: { cellWidth: 12, halign: 'center' }, // No.
                        1: { cellWidth: 72, halign: 'left' }, // タイトル
                        2: { cellWidth: 22, halign: 'center' }, // R.Gt
                        3: { cellWidth: 22, halign: 'center' }, // L.Gt
                        4: { cellWidth: 22, halign: 'center' }, // Bass
                        5: { cellWidth: 18, halign: 'center' }, // BPM
                        6: { cellWidth: 22, halign: 'center' }  // コーラス
                    },
                    margin: { top: topMargin, right: 10, bottom: 10, left: leftMargin },
                    didDrawPage: function (data) { // 各ページ描画後に実行されるフック
                        let str = 'Page ' + detailedPdf.internal.getNumberOfPages();
                        detailedPdf.setFontSize(10);
                        detailedPdf.setFont('NotoSansJP', 'normal');
                        detailedPdf.text(str, detailedPdf.internal.pageSize.getWidth() - 10, detailedPdf.internal.pageSize.getHeight() - 10, { align: 'right' });
                    }
                });

                // 詳細PDFのファイル名を生成
                let detailedFilename = "セットリスト_詳細";
                if (setlistYear && setlistMonth && setlistDay) {
                    detailedFilename += `_${setlistYear}-${setlistMonth}-${setlistDay}`;
                }
                if (setlistVenue) {
                    detailedFilename += `_${setlistVenue}`;
                }
                detailedFilename += ".pdf";

                detailedPdf.save(detailedFilename); // PDFをダウンロード
                console.log("[generateSetlistPdf] Detailed PDF generated and downloaded:", detailedFilename);

                // 少し待ってから次のPDFを生成 (同時ダウンロードによるファイル名競合回避)
                await new Promise(resolve => setTimeout(resolve, 500));

                // --- シンプルPDFの生成 ---
                const simplePdf = new jsPDF('p', 'mm', 'a4');
                registerJapaneseFont(simplePdf); // 日本語フォント登録

                simplePdf.setFont('NotoSansJP', 'bold'); // フォント設定

                const simpleFontSize = 28; // 大きめのフォントサイズ
                simplePdf.setFontSize(simpleFontSize);

                const simpleTopMargin = 30;
                let simpleYPos = simpleTopMargin;

                const simpleLeftMargin = 25;

                // ヘッダー情報 (日付と会場) をシンプルPDFにも表示
                if (headerText) {
                    simplePdf.setFontSize(simpleFontSize + 8); // ヘッダーは少し大きく
                    simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
                    simpleYPos += (simpleFontSize + 8) * 0.7; // 行間を調整
                    simplePdf.setFontSize(simpleFontSize); // 曲名に戻す
                }

                // 曲名を1行ずつ追加
                simplePdfBody.forEach(line => {
                    simplePdf.text(line, simpleLeftMargin, simpleYPos);
                    simpleYPos += simpleFontSize * 0.38; // 行間

                    // ページの下部に近づいたら新しいページを追加
                    const bottomMarginThreshold = simpleFontSize + 10;
                    if (simpleYPos > simplePdf.internal.pageSize.getHeight() - bottomMarginThreshold) {
                        simplePdf.addPage();
                        simpleYPos = simpleTopMargin; // 新しいページの開始位置
                        simplePdf.setFont('NotoSansJP', 'bold'); // フォント再設定
                        simplePdf.setFontSize(simpleFontSize);
                    }
                });

                // シンプルPDFのファイル名を生成
                let simpleFilename = "セットリスト_シンプル";
                if (setlistYear && setlistMonth && setlistDay) {
                    simpleFilename += `_${setlistYear}-${setlistMonth}-${setlistDay}`;
                }
                if (setlistVenue) {
                    simpleFilename += `_${setlistVenue}`;
                }
                simpleFilename += ".pdf";

                simplePdf.save(simpleFilename); // PDFをダウンロード
                console.log("[generateSetlistPdf] Simple PDF generated and downloaded:", simpleFilename);

                showMessageBox("2種類のPDFを生成しました！");

            } catch (error) {
                console.error("[generateSetlistPdf] PDF生成に失敗しました:", error);
                showMessageBox("PDF生成に失敗しました。");
            }
        }




// --- DOMContentLoaded イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application features.");

    // --- セットリストスロットの初期化 ---
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        slot.dataset.slotIndex = index.toString(); // data-slot-index を設定
        const slotNumberSpan = slot.querySelector('.slot-number');
        if (slotNumberSpan) {
            slotNumberSpan.textContent = (index + 1).toString(); // 表示番号を設定
        }
        enableDragAndDrop(slot); // スロットにドラッグ＆ドロップイベントを設定
    });
    console.log("[DOMContentLoaded] Setlist slots initialized and drag & drop enabled.");

    // --- アルバムアイテムにドラッグ＆ドロップイベントを設定 ---
    document.querySelectorAll(".album-content .item").forEach((item) => {
        enableDragAndDrop(item);
        console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId || 'N/A'}`);
    });

    // --- セットリスト内のイベントリスナー (イベント委譲) ---
    // スロット内のチェックボックスに対するクリックイベント
    setlist.addEventListener('click', (e) => {
        const checkbox = e.target.closest('input[type="checkbox"]');
        if (checkbox) {
            e.stopPropagation(); // スロットのダブルクリック/タップイベントとの競合を防ぐ

            const slot = checkbox.closest('.setlist-slot');
            if (!slot) return; // スロット内でなければ何もしない

            const optionType = checkbox.dataset.optionType;
            const isChecked = checkbox.checked;

            if (optionType === 'short') {
                slot.classList.toggle('short', isChecked);
                slot.dataset.short = isChecked ? 'true' : 'false';
            } else if (optionType === 'se') {
                slot.classList.toggle('se-active', isChecked);
                slot.dataset.seChecked = isChecked ? 'true' : 'false';
            } else if (optionType === 'drumsolo') {
                slot.classList.toggle('drumsolo-active', isChecked);
                slot.dataset.drumsoloChecked = isChecked ? 'true' : 'false';
            }
            console.log(`[slotClick] Slot ${slot.dataset.slotIndex} ${optionType} status changed to: ${isChecked}`);
            saveSetlistState(); // 変更を保存

            // ダブルタップ検出ロジックとの競合を防ぐ
            lastTapTime = 0;
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
        }
    });

    // スロットに対するダブルクリック/タップイベント
    setlist.addEventListener("dblclick", (e) => {
        const slot = e.target.closest('.setlist-slot');
        if (slot) {
            handleDoubleClick.call(slot); // 'this' をスロット要素にして呼び出す
        }
    });
    console.log("[DOMContentLoaded] Setlist slot interaction listeners enabled.");

    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    // 年のドロップダウンを生成
    if (setlistYear) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear + 5; i >= currentYear - 30; i--) { // 前30年～後5年まで
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

    // 年と月が変更されたときに日数を更新
    if (setlistYear) setlistYear.addEventListener('change', updateDays);
    if (setlistMonth) setlistMonth.addEventListener('change', updateDays);

    // デフォルトで今日の日付を選択状態にする
    if (setlistYear && setlistMonth && setlistDay) {
        const today = new Date();
        setlistYear.value = today.getFullYear();
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        updateDays(); // 先に日を生成
        setlistDay.value = today.getDate().toString().padStart(2, '0'); // その後、今日の日を選択
        console.log(`[Date Init] Default date set to today: ${setlistYear.value}/${setlistMonth.value}/${setlistDay.value}`);
    }

    // --- Firebaseからセットリストをロードまたは初期曲を配置 ---
    loadSetlistState().then(() => {
        console.log("[DOMContentLoaded] loadSetlistState finished. Performing initial song setup.");

        // URLにshareIdがない場合のみ初期曲を配置
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('shareId')) {
            // スロット0が空の場合のみ追加
            const slot0 = document.querySelector('.setlist-slot[data-slot-index="0"]');
            if (slot0 && !slot0.classList.contains('setlist-item')) {
                const preloadedSongData1 = {
                    name: "CHANCE!",
                    itemId: "album2-001",
                    albumClass: "album2",
                    short: false, seChecked: false, drumsoloChecked: false,
                    hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false,
                    rGt: "Drop D", lGt: "Drop D", bass: "Drop D", bpm: "128", chorus: ""
                };
                fillSlotWithItem(slot0, preloadedSongData1);
                originalAlbumMap.set(preloadedSongData1.itemId, preloadedSongData1.albumClass);
                console.log(`[DOMContentLoaded] Preloaded item ${preloadedSongData1.name} into slot 0.`);
            }

            // スロット1が空の場合のみ追加
            const slot1 = document.querySelector('.setlist-slot[data-slot-index="1"]');
            if (slot1 && !slot1.classList.contains('setlist-item')) {
                const preloadedSongData2 = {
                    name: "トキノナミダ",
                    itemId: "album2-002",
                    albumClass: "album2",
                    short: false, seChecked: false, drumsoloChecked: false,
                    hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false,
                    rGt: "Drop B", lGt: "Drop B", bass: "5 REG", bpm: "198", chorus: ""
                };
                fillSlotWithItem(slot1, preloadedSongData2);
                originalAlbumMap.set(preloadedSongData2.itemId, preloadedSongData2.albumClass);
                console.log(`[DOMContentLoaded] Preloaded item ${preloadedSongData2.name} into slot 1.`);
            }

            // 例: スロット2も初期設定したい場合
            const slot2 = document.querySelector('.setlist-slot[data-slot-index="2"]');
            if (slot2 && !slot2.classList.contains('setlist-item')) {
                const preloadedSongData3 = {
                    name: "SHAMROCK",
                    itemId: "album3-002",
                    albumClass: "album3",
                    short: false, seChecked: false, drumsoloChecked: false,
                    hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false,
                    rGt: "Drop D", lGt: "Drop D", bass: "Drop D", bpm: "160", chorus: "サビ"
                };
                fillSlotWithItem(slot2, preloadedSongData3);
                originalAlbumMap.set(preloadedSongData3.itemId, preloadedSongData3.albumClass);
                console.log(`[DOMContentLoaded] Preloaded item ${preloadedSongData3.name} into slot 2.`);
            }
        }
        // Firebaseロード後、または初期曲追加後に、メニュー表示状態を同期し、状態を保存
        hideSetlistItemsInMenu();
        saveSetlistState();
    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState or initial setup:", error);
        // エラーが発生した場合でもメニューの非表示化は試みる
        hideSetlistItemsInMenu();
    });


    // --- 過去セットリストモーダル関連の処理 ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');
    const closeModalButton = pastSetlistsModal ? pastSetlistsModal.querySelector('.close-button') : null;
    const pastYearsGrid = pastSetlistsModal ? pastSetlistsModal.querySelector('.past-years-grid') : null; // 年のグリッド要素
    const year2025DetailModal = document.getElementById('year2025DetailModal');
    const close2025DetailModalButton = year2025DetailModal ? year2025DetailModal.querySelector('.close-button') : null;
    const setlistLinks = year2025DetailModal ? year2025DetailModal.querySelectorAll('.setlist-link') : [];

    // 「過去セットリスト」ボタンをクリックしたときの処理
    if (openPastSetlistsModalButton && pastSetlistsModal) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            if (menu.classList.contains('open')) {
                toggleMenu(); // ハンバーガーメニューが開いていたら閉じる
            }
            pastSetlistsModal.style.display = 'flex';
            console.log("[Modal] Past Setlists Modal opened. Hamburger menu closed.");
        });
    } else {
        console.warn("[DOMContentLoaded] 'Open Past Setlists Modal' button or modal not found.");
    }

    // 過去セットリストモーダルの閉じるボタン
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            pastSetlistsModal.style.display = 'none';
            console.log("[Modal] Past Setlists Modal closed.");
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log("[Modal] Restored hamburger menu to open state.");
        });
    }

    // モーダルオーバーレイをクリックしたときに閉じる
    if (pastSetlistsModal) {
        pastSetlistsModal.addEventListener('click', (e) => {
            if (e.target === pastSetlistsModal) { // オーバーレイ自体がクリックされた場合
                pastSetlistsModal.style.display = 'none';
                console.log("[Modal] Past Setlists Modal closed by overlay click.");
                toggleMenu(); // ハンバーガーメニューを再度開く
                console.log("[Modal] Restored hamburger menu to open state after overlay click.");
            }
        });
    }

    // 年選択ボタンのクリックイベント（モーダル内のボタン）
    if (pastYearsGrid) {
        pastYearsGrid.addEventListener('click', (e) => {
            const yearButton = e.target.closest('.past-year-item');
            if (yearButton) {
                const year = yearButton.dataset.year;
                console.log(`[Modal] Year ${year} selected.`);
                if (year === '2025' && year2025DetailModal) {
                    pastSetlistsModal.style.display = 'none'; // 年選択モーダルを閉じる
                    year2025DetailModal.style.display = 'flex'; // 2025年詳細モーダルを開く
                    console.log("[Modal] 2025 Detail Modal opened.");
                } else {
                    showCustomMessageBox(`${year}年のセットリストを読み込む機能を実装予定です！`, 2500);
                    pastSetlistsModal.style.display = 'none'; // モーダルを閉じる
                    toggleMenu(); // ハンバーガーメニューを再度開く
                    console.log("[Modal] Restored hamburger menu after year selection.");
                }
            }
        });
    }

    // 2025年詳細モーダルの閉じるボタン
    if (close2025DetailModalButton) {
        close2025DetailModalButton.addEventListener('click', () => {
            year2025DetailModal.style.display = 'none';
            console.log("[Modal] 2025 Detail Modal closed.");
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log("[Modal] Restored hamburger menu after 2025 detail modal closed.");
        });
    }

    // 2025年詳細モーダルのオーバーレイをクリックしたときに閉じる
    if (year2025DetailModal) {
        year2025DetailModal.addEventListener('click', (e) => {
            if (e.target === year2025DetailModal) {
                year2025DetailModal.style.display = 'none';
                console.log("[Modal] 2025 Detail Modal closed by overlay click.");
                toggleMenu(); // ハンバーガーメニューを再度開く
                console.log("[Modal] Restored hamburger menu after 2025 detail modal overlay click.");
            }
        });
    }

    // 過去セットリストのリンクがクリックされたとき（共有URLからロード）
    setlistLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // デフォルトのリンク遷移を防ぐ
            const href = link.getAttribute('href');
            if (href && href.includes('?shareId=')) {
                const shareId = new URLSearchParams(href.split('?')[1]).get('shareId');
                if (shareId) {
                    // 現在のURLを更新して、Firebaseロードをトリガー
                    history.pushState(null, '', `?shareId=${shareId}`);
                    loadSetlistState(); // セットリストをロード
                    // モーダルを閉じる
                    if (year2025DetailModal) year2025DetailModal.style.display = 'none';
                    if (pastSetlistsModal) pastSetlistsModal.style.display = 'none';
                    console.log(`[Modal] Loading setlist from shareId: ${shareId}`);
                    showCustomMessageBox("セットリストを読み込みました！", 2500);
                } else {
                    showCustomMessageBox("共有IDが見つかりませんでした。", 2500);
                }
            } else {
                 // 通常のリンク（Firebase経由でない）の場合は、メッセージを表示するだけ
                 const date = link.dataset.setlistDate;
                 const venue = link.dataset.setlistVenue;
                 showCustomMessageBox(`${date} ${venue} のセットリストを読み込む機能を実装予定です！`, 2500);
            }
            // モーダルを閉じる
            if (year2025DetailModal) year2025DetailModal.style.display = 'none';
            if (pastSetlistsModal) pastSetlistsModal.style.display = 'none';
            toggleMenu(); // ハンバーガーメニューを再度開く
            console.log("[Modal] Restored hamburger menu after setlist link click.");
        });
    });
});