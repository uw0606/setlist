// ==================== グローバル変数とDOM要素の取得 ====================
const setlist = document.getElementById('setlist');
const menu = document.getElementById('menu');
const menuButton = document.getElementById('menuButton');
const albumList = document.getElementById('albumList'); // HTMLにid="albumList"を追加すること
const shareSetlistButton = document.getElementById('shareSetlistButton');
const generatePdfButton = document.getElementById('generatePdfButton');
const customMessageBox = document.getElementById('customMessageBox'); // HTMLにid="customMessageBox"を追加すること

const maxSongs = 26; // セットリストの最大スロット数 (HTMLの数に合わせる)

let database; // Firebase Realtime Database インスタンス

let draggedItem = null; // 現在ドラッグ中のアイテム（PC用）
let originalSetlistSlot = null; // セットリスト内でドラッグ開始した場合の元のスロット
let currentDropZone = null; // 現在ドラッグオーバーしているドロップゾーン

// === タッチデバイス用変数 ===
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false; // タッチ操作がドラッグに移行したか
let touchTimeout = null; // ロングプレス判定用タイマー
let currentTouchDraggedClone = null; // ドラッグ中のクローン要素（タッチ用）
let draggingItemId = null; // ドラッグ中のアイテムのID
let lastTapTime = 0; // ダブルタップ検出用
let rafId = null; // requestAnimationFrame ID
const DRAG_THRESHOLD = 10; // ドラッグと判断する移動量（ピクセル）
let currentTouchTarget = null; // 現在タッチしている要素を保持

const originalAlbumMap = new Map(); // key: itemId, value: HTMLElement (元のアルバムアイテム)

// ==================== ユーティリティ関数 ====================

/**
 * カスタムメッセージボックスを表示する。
 */
function showMessageBox(message, duration = 3000) {
    const messageBoxText = document.getElementById('messageBoxText');
    const messageBoxCloseButton = document.getElementById('messageBoxCloseButton');

    if (!customMessageBox || !messageBoxText || !messageBoxCloseButton) {
        console.error("[showMessageBox] カスタムメッセージボックスの要素が見つかりません。", { customMessageBox, messageBoxText, messageBoxCloseButton });
        alert(message); // デバッグ用にアラートを表示
        return;
    }

    messageBoxText.textContent = message;
    customMessageBox.style.display = 'flex'; // flexboxで中央寄せを想定
    customMessageBox.style.opacity = '1';

    // OKボタンがクリックされたら閉じる
    const closeHandler = () => {
        customMessageBox.style.opacity = '0';
        customMessageBox.addEventListener('transitionend', function handler() {
            customMessageBox.style.display = 'none';
            customMessageBox.removeEventListener('transitionend', handler);
        }, { once: true });
        messageBoxCloseButton.removeEventListener('click', closeHandler); // イベントリスナーを削除
    };
    messageBoxCloseButton.addEventListener('click', closeHandler);

    // durationが設定されている場合、指定時間後に自動で閉じる
    if (duration > 0) {
        setTimeout(() => {
            if (customMessageBox.style.display !== 'none') { // 既に手動で閉じられていないか確認
                closeHandler();
            }
        }, duration);
    }
    console.log(`[showMessageBox] メッセージボックスを表示: ${message}`);
}

/**
 * 日本語フォントをjsPDFに登録する。
 * (NotoSansJP-Regular.ttf と NotoSansJP-Bold.ttf のbase64エンコードデータが必要です)
 * 実際のプロジェクトでは、これらのフォントデータを別途用意して読み込む必要があります。
 * このコードでは簡略化のため、ダミー関数としています。
 * ここに実際のフォント埋め込みコードを記述してください。
 * 例:
 * doc.addFileToVFS('NotoSansJP-Regular.ttf', 'YOUR_BASE64_ENCODED_FONT_DATA_HERE');
 * doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
 * doc.addFileToVFS('NotoSansJP-Bold.ttf', 'YOUR_BASE64_ENCODED_BOLD_FONT_DATA_HERE');
 * doc.addFont('NotoSansJP-Bold.ttf', 'NotoSansJP', 'bold');
 */
function registerJapaneseFont(doc) {
    // 実際にはここに日本語フォントのbase64データを読み込むコードが入ります。
    console.warn("registerJapaneseFont: 日本語フォントのbase64データは含まれていません。PDFの日本語表示には別途設定が必要です。");
    // テスト用に標準フォントを設定 (日本語は表示されない可能性があります)
    doc.setFont('helvetica'); // または'courier', 'times'
}

/**
 * スロットの内容をクリアし、元のアルバムアイテムを再表示する。
 */
function clearSlotContent(slot) {
    const itemId = slot.dataset.itemId;
    console.log(`[clearSlotContent] Clearing slot: ${slot.dataset.slotIndex}, item ID: ${itemId}`);

    // アルバムアイテムの場合、元のアイテムを再表示
    if (itemId) {
        const originalItem = originalAlbumMap.get(itemId);
        if (originalItem) {
            originalItem.style.visibility = ''; // 非表示を解除
            console.log(`[clearSlotContent] Restored original album item: ${itemId}`);
        }
        originalAlbumMap.delete(itemId); // マップから削除
    }

    slot.innerHTML = '';
    slot.classList.remove('setlist-item', 'short', 'se-active', 'drumsolo-active');
    slot.classList.remove('album1', 'album2', 'album3', 'album4', 'album5', 'album6', 'album7', 'album8', 'album9', 'album10', 'album11', 'album12', 'album13', 'album14'); // albumクラスを削除
    slot.removeAttribute('data-item-id');
    slot.removeAttribute('data-name');
    slot.removeAttribute('data-r-gt');
    slot.removeAttribute('data-l-gt');
    slot.removeAttribute('data-bass');
    slot.removeAttribute('data-bpm');
    slot.removeAttribute('data-chorus');
    slot.removeAttribute('data-short');
    slot.removeAttribute('data-se-checked');
    slot.removeAttribute('data-drumsolo-checked');
    slot.classList.remove('setlist-slot-text'); // テキストスロットのクラスも削除
    slot.textContent = 'ここに曲をドラッグ＆ドロップ'; // 初期テキストに戻す

    // イベントリスナーを再設定 (既存のリスナーを削除してから追加)
    if (typeof slot._clickHandler !== 'undefined') {
        slot.removeEventListener('click', slot._clickHandler);
        delete slot._clickHandler;
    }
    if (typeof slot._dblclickHandler !== 'undefined') {
        slot.removeEventListener('dblclick', slot._dblclickHandler);
        delete slot._dblclickHandler;
    }
    if (typeof slot._touchstartHandler !== 'undefined') {
        slot.removeEventListener('touchstart', slot._touchstartHandler);
        delete slot._touchstartHandler;
    }

    // 新しいクリックハンドラを登録（テキストスロット変換用）
    slot._clickHandler = (e) => {
        // チェックボックスがクリックされた場合は処理しない
        if (e.target.closest('input[type="checkbox"]')) {
            return;
        }

        // ダブルタップ検出ロジックは handleTouchStart で処理
        if (lastTapTime && (new Date().getTime() - lastTapTime < 300)) {
            // ダブルタップと判定されたら、ここでは何もしない
            return;
        }
        
        // シングルクリックの場合は、テキストスロットに変換
        convertToTextSlot(slot);
        lastTapTime = new Date().getTime(); // シングルタップの時間を記録
    };
    slot.addEventListener('click', slot._clickHandler);
}


/**
 * スロットに曲データをセットする。
 * @param {HTMLElement} slot - セットリストのスロット要素
 * @param {Object} itemData - 曲のデータオブジェクト
 */
function fillSlotWithItem(slot, itemData) {
    console.log(`[fillSlotWithItem] Filling slot ${slot.dataset.slotIndex} with item:`, itemData);

    // 既存のコンテンツと属性をクリア
    clearSlotContent(slot); // まずクリアしてから設定
    slot.textContent = ''; // 初期テキストを削除
    
    slot.classList.add('setlist-item');
    slot.classList.add(itemData.albumClass); // アルバムクラスを追加

    // data属性を設定
    slot.dataset.itemId = itemData.itemId;
    slot.dataset.albumClass = itemData.albumClass;
    slot.dataset.name = itemData.name;
    slot.dataset.rGt = itemData.rGt || '';
    slot.dataset.lGt = itemData.lGt || '';
    slot.dataset.bass = itemData.bass || '';
    slot.dataset.bpm = itemData.bpm || '';
    slot.dataset.chorus = itemData.chorus || '';

    // オプション（short, se, drumsolo）の状態を復元
    slot.dataset.short = itemData.short ? 'true' : 'false';
    slot.dataset.seChecked = itemData.seChecked ? 'true' : 'false';
    slot.dataset.drumsoloChecked = itemData.drumsoloChecked ? 'true' : 'false';

    if (itemData.short) slot.classList.add('short');
    if (itemData.seChecked) slot.classList.add('se-active');
    if (itemData.drumsoloChecked) slot.classList.add('drumsolo-active');

    // UI要素を動的に生成して追加
    const songInfoContainer = document.createElement('div');
    songInfoContainer.classList.add('song-info-container');

    const songNameAndOption = document.createElement('div');
    songNameAndOption.classList.add('song-name-and-option');

    const songName = document.createElement('span');
    songName.classList.add('song-name');
    songName.textContent = itemData.name;
    songNameAndOption.appendChild(songName);

    // オプションチェックボックスの追加
    const options = [
        { type: 'short', label: 'Short', checked: itemData.short },
        { type: 'se', label: 'SE', checked: itemData.seChecked },
        { type: 'drumsolo', label: 'Dr', checked: itemData.drumsoloChecked }
    ];

    options.forEach(option => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('checkbox-wrapper');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `checkbox-${slot.dataset.slotIndex}-${option.type}`;
        checkbox.dataset.optionType = option.type;
        checkbox.checked = option.checked;

        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.textContent = option.label;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        songNameAndOption.appendChild(wrapper);
    });

    const additionalInfo = document.createElement('div');
    additionalInfo.classList.add('additional-song-info');
    additionalInfo.innerHTML = `
        R.Gt: ${itemData.rGt || '-'} | L.Gt: ${itemData.lGt || '-'} | Bass: ${itemData.bass || '-'} | BPM: ${itemData.bpm || '-'} | Chorus: ${itemData.chorus || '-'}
    `;

    songInfoContainer.appendChild(songNameAndOption);
    songInfoContainer.appendChild(additionalInfo);
    slot.appendChild(songInfoContainer);

    // Xボタン（削除ボタン）の追加
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 親要素のクリックイベントが発火するのを防ぐ
        clearSlotContent(slot);
        console.log(`[fillSlotWithItem] Delete button clicked for slot: ${slot.dataset.slotIndex}`);
    });
    slot.appendChild(deleteButton);

    // Drag and drop events for the filled slot
    enableDragAndDrop(slot);

    // DBLCLICK (モバイルではダブルタップ) でテキストスロットに戻す
    if (typeof slot._dblclickHandler !== 'undefined') {
        slot.removeEventListener('dblclick', slot._dblclickHandler);
    }
    slot._dblclickHandler = () => {
        console.log(`[dblclick] Slot ${slot.dataset.slotIndex} double clicked.`);
        convertToTextSlot(slot);
    };
    slot.addEventListener('dblclick', slot._dblclickHandler);

    // ロード時に既にメニューアイテムが存在する場合は非表示にする
    const originalAlbumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
    if (originalAlbumItemInMenu) {
        originalAlbumMap.set(itemData.itemId, albumItemInMenu); // マップに保存
        albumItemInMenu.style.visibility = 'hidden';
        console.log(`[fillSlotWithItem] Hid original album item in menu: ${itemData.itemId}`);
    } else {
        console.warn(`[fillSlotWithItem] Original album item not found in menu for ID: ${itemData.itemId}`);
    }
}


/**
 * セットリストスロットをテキスト入力可能なスロットに変換する。
 */
function convertToTextSlot(slot) {
    const currentText = slot.textContent.trim() === 'ここに曲をドラッグ＆ドロップ' ? '' : getSlotItemData(slot).name || slot.textContent.trim();
    clearSlotContent(slot); // まずクリアして、通常の曲アイテムとしての状態をリセット

    slot.classList.add('setlist-slot-text');
    slot.removeAttribute('data-item-id'); // itemIdを削除

    const textarea = document.createElement('textarea');
    textarea.classList.add('setlist-text-input');
    textarea.value = currentText;
    textarea.placeholder = 'テキストを入力してください';
    textarea.rows = 2; // 初期表示の行数
    
    // スロットのクリアボタンを再作成し、テキストスロットに対応させる
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.classList.add('delete-button');
    deleteButton.style.position = 'absolute';
    deleteButton.style.top = '5px';
    deleteButton.style.right = '5px';
    deleteButton.style.width = '25px';
    deleteButton.style.height = '25px';
    deleteButton.style.lineHeight = '20px'; // 垂直方向の中央揃え
    deleteButton.style.fontSize = '0.8em';

    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 親要素のクリックイベントが発火するのを防ぐ
        clearSlotContent(slot); // スロットを完全にクリアして初期状態に戻す
        console.log(`[convertToTextSlot] Text slot cleared by delete button: ${slot.dataset.slotIndex}`);
    });

    slot.appendChild(textarea);
    slot.appendChild(deleteButton); // textareaの後に追加
    textarea.focus(); // 自動的にフォーカス

    // テキストエリアの入力内容が変更されたら、スロットのテキストコンテンツを更新
    textarea.addEventListener('input', () => {
        slot.textContent = textarea.value; // PDF生成時に使用されるテキストコンテンツを更新
        // テキストエリアの高さ自動調整
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    });
    // 初期表示で高さを調整
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    // テキストエリアが空になったら初期テキストを表示
    textarea.addEventListener('blur', () => {
        if (textarea.value.trim() === '') {
            clearSlotContent(slot);
        }
    });

    console.log(`[convertToTextSlot] Slot ${slot.dataset.slotIndex} converted to text slot.`);
}


/**
 * スロットまたはアイテムから曲データを取得する。
 * @param {HTMLElement} element - スロットまたはアイテム要素
 * @returns {Object|null} 曲データオブジェクト
 */
function getSlotItemData(element) {
    if (!element || !element.dataset) {
        return null;
    }
    // テキストスロットの場合はテキストコンテンツを返す
    if (element.classList.contains('setlist-slot-text')) {
        const textarea = element.querySelector('.setlist-text-input');
        return {
            type: 'text',
            slotIndex: element.dataset.slotIndex,
            textContent: textarea ? textarea.value.trim() : element.textContent.trim()
        };
    }

    // 通常の曲アイテムの場合
    return {
        type: 'song',
        itemId: element.dataset.itemId || '',
        albumClass: element.dataset.albumClass || '',
        name: element.dataset.name || '',
        rGt: element.dataset.rGt || '',
        lGt: element.dataset.lGt || '',
        bass: element.dataset.bass || '',
        bpm: element.dataset.bpm || '',
        chorus: element.dataset.chorus || '',
        short: element.dataset.short === 'true',
        seChecked: element.dataset.seChecked === 'true',
        drumsoloChecked: element.dataset.drumsoloChecked === 'true',
        slotIndex: element.dataset.slotIndex // setlist-slotのみ
    };
}


/**
 * ドラッグ開始イベントのハンドラ。
 */
function handleDragStart(event) {
    console.log("[handleDragStart] Drag started.");
    event.dataTransfer.setData("text/plain", event.target.dataset.itemId || ''); // IDを転送
    event.dataTransfer.effectAllowed = "move"; // 移動を許可
    draggedItem = event.target; // ドラッグ中のアイテムを保持

    // 元のスロットがセットリスト内のアイテムの場合、その情報を保存
    if (setlist.contains(draggedItem) && draggedItem.classList.contains('setlist-item')) {
        originalSetlistSlot = draggedItem;
        // 元のスロットのデータを保存（ドラッグ完了時に元の場所に戻すか、削除するかを判断するため）
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
        console.log(`[handleDragStart] Dragging from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
    } else {
        originalSetlistSlot = null; // アルバムアイテムからのドラッグ
    }

    // ドラッグ元の要素にクラスを追加
    setTimeout(() => {
        event.target.classList.add("dragging");
    }, 0);
}

/**
 * ドラッグ要素がドロップゾーン上にある時のハンドラ。
 */
function handleDragOver(event) {
    event.preventDefault(); // デフォルトの動作（ドロップ禁止）をキャンセル
    event.dataTransfer.dropEffect = "move";

    const target = event.target.closest(".setlist-slot");

    if (target && target !== currentDropZone) {
        // 以前のドロップゾーンがあればクラスを削除
        if (currentDropZone) {
            currentDropZone.classList.remove("drag-over");
        }
        // 新しいドロップゾーンにクラスを追加
        target.classList.add("drag-over");
        currentDropZone = target;
    } else if (!target && currentDropZone) {
        // ドロップゾーンから外れた場合
        currentDropZone.classList.remove("drag-over");
        currentDropZone = null;
    }
}

/**
 * ドラッグ要素がドロップゾーンを離れた時のハンドラ。
 */
function handleDragLeave(event) {
    const target = event.target.closest(".setlist-slot");
    if (target && target === currentDropZone) {
        target.classList.remove("drag-over");
        currentDropZone = null;
    }
}

/**
 * ドロップイベントのハンドラ。
 */
function handleDrop(event) {
    event.preventDefault(); // デフォルトの動作をキャンセル

    // 全ての drag-over クラスを削除
    document.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
    });

    const dropTargetSlot = event.target.closest(".setlist-slot");

    processDrop(draggedItem, dropTargetSlot, originalSetlistSlot);

    // ドラッグ終了時のクリーンアップ
    draggedItem = null;
    originalSetlistSlot = null;
    currentDropZone = null;
}

/**
 * ドラッグ終了イベントのハンドラ。
 */
function handleDragEnd(event) {
    console.log("[handleDragEnd] Drag ended.");
    if (draggedItem) {
        draggedItem.classList.remove("dragging"); // 透明度を元に戻す
    }
    // `currentDropZone` は `handleDrop` でリセットされるはずだが、念のためここでもリセット
    if (currentDropZone) {
        currentDropZone.classList.remove("drag-over");
        currentDropZone = null;
    }
    draggedItem = null;
    originalSetlistSlot = null;
}

/**
 * ドロップ処理の共通ロジック。PCドラッグ＆ドロップとタッチドラッグ＆ドロップの両方から呼び出される。
 * @param {HTMLElement} itemToDrop - ドロップするアイテム（元のアルバムアイテム、またはセットリスト内の移動元アイテム）
 * @param {HTMLElement|null} dropTargetSlot - ドロップ先のセットリストスロット
 * @param {HTMLElement|null} originalSourceSlot - セットリスト内での移動の場合の元のスロット
 */
function processDrop(itemToDrop, dropTargetSlot, originalSourceSlot) {
    console.log("[processDrop] Processing drop. Item:", itemToDrop, "Target:", dropTargetSlot, "Source:", originalSourceSlot);

    if (!dropTargetSlot) {
        console.log("[processDrop] Dropped outside setlist. No action taken unless it was a move out from setlist.");
        // セットリストから外にドラッグして削除する場合
        if (originalSourceSlot) {
            clearSlotContent(originalSourceSlot);
            console.log("[processDrop] Item removed from setlist by dragging outside.");
        }
        return;
    }

    if (itemToDrop === dropTargetSlot) {
        console.log("[processDrop] Dropped onto itself. No action.");
        return;
    }

    const itemData = getSlotItemData(itemToDrop);
    if (!itemData) {
        console.error("[processDrop] Could not get item data from itemToDrop:", itemToDrop);
        return;
    }
    
    // ドロップ先のスロットがテキストスロットだった場合、上書き確認
    if (dropTargetSlot.classList.contains('setlist-slot-text')) {
        const confirmOverwrite = confirm('このスロットにはテキストが入力されています。上書きしますか？');
        if (!confirmOverwrite) {
            console.log("[processDrop] Overwrite cancelled by user.");
            return;
        }
    }

    // ドロップ先にすでにアイテムがあるかチェック
    const existingItemDataInTarget = getSlotItemData(dropTargetSlot);
    const targetHasItem = existingItemDataInTarget && existingItemDataInTarget.type === 'song';

    if (originalSourceSlot) { // セットリスト内での移動
        console.log("[processDrop] Moving item within setlist.");
        // 元のスロットのデータを取得
        const originalItemData = originalSourceSlot._originalItemData || getSlotItemData(originalSourceSlot);
        if (!originalItemData) {
            console.error("[processDrop] Could not retrieve original item data for move operation.");
            return;
        }

        if (targetHasItem) { // ドロップ先にアイテムがある場合は入れ替え
            console.log("[processDrop] Swapping items.");
            fillSlotWithItem(originalSourceSlot, existingItemDataInTarget);
            fillSlotWithItem(dropTargetSlot, originalItemData);
        } else { // ドロップ先にアイテムがない場合は移動
            console.log("[processDrop] Moving to empty slot.");
            fillSlotWithItem(dropTargetSlot, originalItemData);
            clearSlotContent(originalSourceSlot); // 元のスロットをクリア
        }
    } else { // アルバムメニューからの新規追加
        console.log("[processDrop] Adding new item from album menu.");
        if (targetHasItem) { // ドロップ先にアイテムがある場合は入れ替え（ドロップ先のアイテムをアルバムに戻す）
            console.log("[processDrop] Replacing existing item with new one.");
            // ドロップ先のアイテムをアルバムに戻す
            const currentItemIdInTarget = existingItemDataInTarget.itemId;
            const originalItemInMenu = originalAlbumMap.get(currentItemIdInTarget);
            if (originalItemInMenu) {
                originalItemInMenu.style.visibility = ''; // 非表示を解除
                originalAlbumMap.delete(currentItemIdInTarget);
                console.log(`[processDrop] Returned ${currentItemIdInTarget} to menu.`);
            }
            fillSlotWithItem(dropTargetSlot, itemData);
        } else { // ドロップ先にアイテムがない場合は追加
            console.log("[processDrop] Adding to empty slot.");
            fillSlotWithItem(dropTargetSlot, itemData);
            // アルバムメニューから追加されたアイテムを非表示にする
            itemToDrop.style.visibility = 'hidden';
            originalAlbumMap.set(itemData.itemId, itemToDrop);
            console.log(`[processDrop] Hid ${itemData.itemId} from menu.`);
        }
    }
}

/**
 * ドラッグ＆ドロップイベントリスナーを要素に設定する。
 * @param {HTMLElement} element - イベントリスナーを設定する要素
 */
function enableDragAndDrop(element) {
    // 既存のイベントリスナーを削除（重複登録防止）
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('drop', handleDrop);
    element.removeEventListener('dragend', handleDragEnd);

    // タッチイベントリスナーも削除
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd); // touchcancelもtouchendと同じ処理で良い場合

    // PC用ドラッグ＆ドロップイベント
    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragend', handleDragEnd);

    // モバイル用タッチイベント
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd); // touchcancelもtouchendと同じ処理で良い場合
}

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
        // チェックボックスクリック時は preventDefault を呼ばない
        return; 
    }

    const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");
    if (!touchedElement) {
        console.warn("[touchstart:Mobile] No draggable item found on touch start.");
        return;
    }

    // ここではまだ event.preventDefault() を呼ばない！
    // スクロールを許可するため。

    currentTouchTarget = touchedElement; // 現在タッチしている要素を保持
    draggingItemId = touchedElement.dataset.itemId;
    
    if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
        originalSetlistSlot = touchedElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
        console.log(`[touchstart:Mobile] Potential drag from setlist slot: ${originalSetlistSlot.dataset.slotIndex}, data:`, originalSetlistSlot._originalItemData);
    } else {
        originalSetlistSlot = null; // アルバムアイテムからのドラッグ
    }

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // ダブルタップ検出ロジック
    if (tapLength < 300 && tapLength > 0) {
        // ダブルタップと判定されたら、ドラッグ開始タイマーを設定せず、通常のダブルクリックハンドラを呼び出す
        // preventDefault() は handleDoubleClick 内で必要に応じて呼ばれる
        handleDoubleClick(event); 
        lastTapTime = 0; // ダブルタップ処理後はリセット
        if (touchTimeout) { // 念のため、残っているタイマーをクリア
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        currentTouchTarget = null; // ダブルタップとして処理されたので、ドラッグの候補から外す
        return; // これ以上ドラッグ開始処理は行わない
    }
    lastTapTime = currentTime; // 次のタップのために時間を記録

    // ロングプレスまたは移動によってドラッグを開始するためのタイマーを設定
    // このタイマーは、移動量が閾値を超えなかった場合にロングプレスとしてドラッグを開始するためのもの
    touchTimeout = setTimeout(() => {
        if (!isDragging && currentTouchTarget && document.body.contains(currentTouchTarget)) {
            // ロングプレスでドラッグを開始する場合、ここでクローンを作成
            console.log("[touchstart:Mobile] Long press timeout reached. Initiating drag.");
            createTouchDraggedClone(currentTouchTarget, touchStartX, touchStartY, draggingItemId);
            isDragging = true;
            // ロングプレスによるドラッグ開始時もスクロールをブロック
            event.preventDefault(); 
        }
        touchTimeout = null; // タイマー完了でクリア
    }, 600); // 600ミリ秒のロングプレス待機
}

/**
 * タッチ移動時の処理
 */
function handleTouchMove(event) {
    // まだドラッグが開始されていない、かつタッチターゲットがある場合のみ、ドラッグ開始判定を行う
    if (!isDragging && currentTouchTarget) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;

        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        // 一定の移動量を超えたらドラッグを開始し、スクロールを阻止
        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
            // スクロールをブロックするために event.preventDefault() を呼ぶ
            event.preventDefault(); 
            isDragging = true; // ドラッグ状態に設定

            // ロングプレスタイマーが設定されていればクリア（移動があったのでロングプレスである必要はなくなった）
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }

            // クローン要素を作成してドラッグを開始
            createTouchDraggedClone(currentTouchTarget, touchStartX, touchStartY, draggingItemId);
            console.log("[handleTouchMove:Mobile] Dragging initiated due to movement threshold.");
            // currentTouchTarget = null; // ドラッグ開始後はもう不要。touchendでリセット
        } else {
            // 閾値以下の移動なら、まだスクロールをブロックしない
            return; 
        }
    }
    
    // ドラッグが開始されている場合のみ、クローンを移動し、スクロールをブロック
    if (isDragging && currentTouchDraggedClone) {
        event.preventDefault(); // ドラッグ中は常にデフォルトのスクロールをキャンセル

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

            // ドロップゾーンのハイライト処理
            // 元のセットリストスロットからドラッグしている場合、自身のスロットはハイライトしない
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
}

/**
 * タッチ終了時の処理
 */
function handleTouchEnd(event) {
    // ロングプレスタイマーがまだ実行中だった場合（短くタップして指を離した）
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] Touch was a tap/short press, not a drag. Clearing timeout and returning.");
        isDragging = false; 
        currentTouchTarget = null; // リセット
        // ここでpreventDefaultを呼ばないことで、通常のクリックイベントやスクロールが発火する
        return;
    }

    // ドラッグが行われていなかった場合は、ここで処理を終了 (isDraggingがfalseの場合)
    if (!isDragging) {
        console.log("[touchend] Not in dragging state. Skipping drop processing.");
        currentTouchTarget = null; // リセット
        return; 
    }
    
    console.log("[touchend] event fired. isDragging:", isDragging);

    if (!currentTouchDraggedClone) {
        console.error("[touchend] currentTouchDraggedClone is null despite dragging. This should not happen.");
        finishDragging(); 
        return;
    }

    // すべてのハイライトを解除
    document.querySelectorAll('.setlist-slot.drag-over')
        .forEach(slot => slot.classList.remove('drag-over'));
    
    const touch = event.changedTouches[0];
    let dropTargetSlot = null;
    if (touch) {
        // elementFromPointはクローン要素の下にある要素を検出
        currentTouchDraggedClone.style.display = 'none'; // 一時的にクローンを非表示にして下の要素を検出
        const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
        currentTouchDraggedClone.style.display = ''; // クローンを元に戻す

        dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));
    }
    
    console.log("[touchend] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (outside setlist)");

    // `processDrop` に処理を委譲
    processDrop(currentTouchTarget, dropTargetSlot, originalSetlistSlot); // currentTouchTargetを渡す

    finishDragging(); // 全体的なクリーンアップ
    currentTouchTarget = null; // リセット
}

/**
 * タッチでのドラッグ時に表示するクローン要素を作成する。
 */
function createTouchDraggedClone(originalElement, x, y, itemId) {
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add('touch-dragging-clone');
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローンがイベントを吸収しないようにする
    currentTouchDraggedClone.style.zIndex = '99999'; // 最前面に表示
    currentTouchDraggedClone.style.width = originalElement.offsetWidth + 'px';
    currentTouchDraggedClone.style.height = originalElement.offsetHeight + 'px';
    currentTouchDraggedClone.style.whiteSpace = 'nowrap'; // テキストが途中で改行されないように
    currentTouchDraggedClone.style.overflow = 'hidden'; // はみ出したテキストは隠す
    currentTouchDraggedClone.style.textOverflow = 'ellipsis'; // 省略記号

    // チェックボックスがクローンされるとIDが重複するため、変更または削除
    currentTouchDraggedClone.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.id = cb.id + '-clone'; // IDを変更
        if (cb.labels && cb.labels.length > 0) {
            cb.labels[0].setAttribute('for', cb.id); // labelのfor属性も更新
        }
        // クローン上のチェックボックスは操作できないようにする
        cb.disabled = true;
    });

    document.body.appendChild(currentTouchDraggedClone);

    // クローンをタッチ位置に正確に配置
    const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
    currentTouchDraggedClone.style.left = (x - cloneRect.width / 2) + 'px';
    currentTouchDraggedClone.style.top = (y - cloneRect.height / 2) + 'px';

    console.log("[createTouchDraggedClone] Touch dragging clone created.");
}

/**
 * ドラッグ終了後のクリーンアップ処理（タッチ用）。
 */
function finishDragging() {
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
        console.log("[finishDragging] Touch dragging clone removed.");
    }

    // ハイライトを全て削除
    document.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
    });

    isDragging = false;
    draggingItemId = null;
    originalSetlistSlot = null; // 元のスロット情報もリセット
    currentDropZone = null; // ドロップゾーンのリセット
    
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    console.log("[finishDragging] Dragging state reset.");
}

/**
 * モバイルでダブルタップが検出された際の処理。
 */
function handleDoubleClick(event) {
    const slot = event.target.closest('.setlist-slot');
    if (slot && typeof slot._dblclickHandler === 'function') {
        event.preventDefault(); // デフォルトのズームなどを防ぐ
        slot._dblclickHandler(); // スロットに設定されたダブルクリックハンドラを呼び出す
        console.log(`[handleDoubleClick] Double tap processed for slot: ${slot.dataset.slotIndex}`);
    } else {
        console.log("[handleDoubleClick] Double tap, but no slot or dblclick handler found.");
    }
}


// ==================== 初期化処理 ====================

// セットリストスロットの初期生成
function initializeSetlistSlots() {
    for (let i = 0; i < maxSongs; i++) {
        const slot = document.createElement('li');
        slot.classList.add('setlist-slot');
        slot.dataset.slotIndex = i.toString(); // スロットにインデックスを設定
        setlist.appendChild(slot);
        clearSlotContent(slot); // 初期状態をセット
    }
    console.log("[initializeSetlistSlots] Setlist slots created.");
}

// Firebaseのコンフィグが設定された後に初期化を行う
document.addEventListener('firebase_ready', () => {
    console.log("[firebase_ready] Firebase is ready. Initializing database.");
    if (firebase && firebase.database) {
        database = firebase.database(); 
        // ロード処理はDOMContentLoadedで実行されるloadSetlistStateに任せる
    } else {
        console.error("Firebase database not available.");
        showMessageBox("Firebaseの初期化に失敗しました。");
    }
});


// ハンバーガーメニューの開閉
if (menuButton) { // menuButtonが存在するか確認
    menuButton.addEventListener('click', () => {
        toggleMenu();
    });
} else {
    console.warn("[Menu] menuButton 要素が見つかりません。");
}

function toggleMenu() {
    if (menu) { // menuが存在するか確認
        menu.classList.toggle('open');
    }
    if (menuButton) { // menuButtonが存在するか確認
        menuButton.classList.toggle('open');
    }
    console.log("[toggleMenu] Menu toggled. State:", menu ? (menu.classList.contains('open') ? 'open' : 'closed') : 'N/A');
}


// アルバムタブの切り替え
if (albumList) { // albumListが存在するか確認
    albumList.addEventListener('click', (event) => {
        const targetTab = event.target.closest('li[data-album]');
        if (targetTab) {
            const albumId = targetTab.dataset.album;
            const currentActiveAlbum = document.querySelector('.album-content.active');
            const targetAlbumContent = document.getElementById(albumId);

            if (currentActiveAlbum && currentActiveAlbum.id === albumId) {
                // 同じタブをクリックしたら閉じる
                currentActiveAlbum.classList.remove('active');
                console.log(`[albumTab] Album ${albumId} closed.`);
            } else {
                // 他のタブを開くか、閉じてから新しいタブを開く
                if (currentActiveAlbum) {
                    currentActiveAlbum.classList.remove('active');
                    console.log(`[albumTab] Album ${currentActiveAlbum.id} closed.`);
                }
                if (targetAlbumContent) {
                    targetAlbumContent.classList.add('active');
                    console.log(`[albumTab] Album ${albumId} opened.`);
                }
            }
        }
    });
} else {
    console.warn("[AlbumTab] albumList 要素が見つかりません。アルバムタブ機能が動作しません。");
}


/**
 * 現在のセットリストの状態を取得する。
 */
function getCurrentState() {
    const setlistItems = [];
    setlist.querySelectorAll('.setlist-slot').forEach((slot) => {
        const slotData = getSlotItemData(slot);
        if (slotData && (slotData.type === 'song' || (slotData.type === 'text' && slotData.textContent.trim() !== ''))) {
            setlistItems.push(slotData);
        }
    });

    const openAlbums = [];
    document.querySelectorAll('.album-content.active').forEach(album => {
        openAlbums.push(album.id);
    });

    const setlistYear = document.getElementById('setlistYear').value;
    const setlistMonth = document.getElementById('setlistMonth').value;
    const setlistDay = document.getElementById('setlistDay').value;
    const setlistVenue = document.getElementById('setlistVenue').value;

    const setlistDate = setlistYear && setlistMonth && setlistDay ? `${setlistYear}-${setlistMonth}-${setlistDay}` : '';

    return {
        setlist: setlistItems,
        menuOpen: menu ? menu.classList.contains('open') : false, // menuが存在しない場合を考慮
        openAlbums: openAlbums,
        setlistDate: setlistDate,
        setlistVenue: setlistVenue,
    };
}

/**
 * 現在のセットリストの状態をFirebase Realtime Database に保存し、共有可能なURLを生成する。
 */
async function shareSetlist() {
    showMessageBox("共有URLを生成中...");
    console.log("[shareSetlist] Sharing process started.");

    if (typeof firebase === 'undefined' || !firebase.database || !database) {
        showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    try {
        const state = getCurrentState();
        console.log("[shareSetlist] Current state to save:", state);

        const newSetlistRef = database.ref('setlists').push();
        await newSetlistRef.set(state);

        const shareId = newSetlistRef.key;
        const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

        // クリップボードにコピー
        await navigator.clipboard.writeText(shareUrl);
        showMessageBox("URLをクリップボードにコピーしました！");
        console.log("[shareSetlist] Share URL copied to clipboard:", shareUrl);

    } catch (error) {
        console.error("セットリストの共有に失敗しました:", error);
        showMessageBox("共有に失敗しました。");
    }
}

if (shareSetlistButton) { // shareSetlistButtonが存在するか確認
    shareSetlistButton.addEventListener('click', shareSetlist);
} else {
    console.warn("[ShareSetlist] shareSetlistButton 要素が見つかりません。");
}


/**
 * メニュー内のアルバムアイテムのうち、セットリストにあるものを非表示にする。
 * 主にロード後に呼び出され、初期表示を同期する。
 */
function hideSetlistItemsInMenu() {
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.visibility = ''; // まず全て表示に戻す
    });
    originalAlbumMap.clear(); // マップもクリア

    setlist.querySelectorAll('.setlist-slot.setlist-item').forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
            if (albumItemInMenu) {
                albumItemInMenu.style.visibility = 'hidden';
                originalAlbumMap.set(itemId, albumItemInMenu);
                console.log(`[hideSetlistItemsInMenu] Hid ${itemId} in menu on load.`);
            }
        }
    });
    console.log("[hideSetlistItemsInMenu] Initial menu item visibility synchronized.");
}


// ==================== PDF生成機能 ====================

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
    let simpleItemNoForNumberedList = 1; // シンプルPDFの連番用（album1以外）

    // album1として扱うdata-item-idのリスト
    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

    for (const slot of setlistSlots) {
        const slotData = getSlotItemData(slot);
        if (slotData) {
            if (slotData.type === 'song') {
                let titleText = slotData.name || '';
                if (slotData.short) {
                    titleText += ' (Short)';
                }
                if (slotData.seChecked) {
                    titleText += ' (SE有り)';
                }
                if (slotData.drumsoloChecked) {
                    titleText += ' (ドラムソロ有り)';
                }

                const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                // --- 詳細PDF用の行の生成 ---
                let currentDetailedItemNo = '';
                if (!isAlbum1) { // album1でなければ連番を振る
                    currentDetailedItemNo = detailedItemNo.toString();
                    detailedItemNo++;
                }
                const detailedRow = [
                    currentDetailedItemNo,
                    titleText,
                    slotData.rGt || '',
                    slotData.lGt || '',
                    slotData.bass || '',
                    slotData.bpm || '',
                    slotData.chorus || ''
                ];
                tableBody.push(detailedRow);

                // --- シンプルPDF用の行の生成 ---
                if (isAlbum1) {
                    simplePdfBody.push(`    ${titleText}`); // インデント
                } else {
                    simplePdfBody.push(`${simpleItemNoForNumberedList}. ${titleText}`);
                    simpleItemNoForNumberedList++; // album1以外の曲の場合のみ連番をインクリメント
                }
            } else if (slotData.type === 'text' && slotData.textContent.trim() !== '') {
                const textContent = slotData.textContent.trim();
                // 詳細PDF用の行 (テキストスロットはNo.なし、タイトル列に全文)
                tableBody.push(['', textContent, '', '', '', '', '']); 
                // シンプルPDF用の行 (テキストスロットはNo.なし、そのまま追加)
                simplePdfBody.push(textContent);
            }
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
            simpleYPos += simpleFontSize * 0.8; // ヘッダーと曲リストの間の余白を大幅に増やす
            simplePdf.setFontSize(simpleFontSize); // 曲リスト用に戻す
        }

        // 各曲目をテキストとして追加
        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 0.5; // 行の高さを調整

            // ページ下部に近づいたら新しいページを追加
            const bottomMarginThreshold = simpleTopMargin - 10; // 下部マージン
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

if (generatePdfButton) { // generatePdfButtonが存在するか確認
    generatePdfButton.addEventListener('click', generateSetlistPdf);
} else {
    console.warn("[PDFGeneration] generatePdfButton 要素が見つかりません。");
}


/**
 * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
 * @returns {Promise<void>} ロード処理の完了を示すPromise
 */
function loadSetlistState() {
  return new Promise((resolve, reject) => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('shareId');

    if (shareId) {
      if (typeof firebase === 'undefined' || !firebase.database || !database) {
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
            for (let i = 0; i < maxSongs; i++) {
              // スロットが存在することを確認してからクリア
              const slot = setlist.querySelector(`.setlist-slot[data-slot-index="${i}"]`);
              if (slot) {
                  clearSlotContent(slot);
              }
            }
            // アルバムアイテムの表示状態をリセット
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.visibility = '';
            });
            // originalAlbumMap をクリア
            originalAlbumMap.clear();
            console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

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
                    
                    if (typeof updateDays === 'function') {
                        updateDays(); // 月が変わったら日を更新
                    } else {
                        console.warn("[loadSetlistState] updateDays function is not defined. Day dropdown might not be correctly populated.");
                    }
                    setlistDay.value = dateParts[2];

                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found. Initializing to today.");
                // 日付が保存されていない、または要素がない場合は今日の日付を設定
                if (setlistYear) setlistYear.value = new Date().getFullYear();
                if (setlistMonth) setlistMonth.value = (new Date().getMonth() + 1).toString().padStart(2, '0');
                if (typeof updateDays === 'function') updateDays(); 
                if (setlistDay) setlistDay.value = new Date().getDate().toString().padStart(2, '0');
            }
            // 会場の復元
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            // セットリストアイテムの復元
            state.setlist.forEach(itemData => {
                const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
                if (targetSlot) {
                    if (itemData.type === 'text') {
                        // テキストスロットの復元
                        convertToTextSlot(targetSlot); // まずテキストスロットに変換
                        const textarea = targetSlot.querySelector('.setlist-text-input');
                        if (textarea) {
                            textarea.value = itemData.textContent;
                            targetSlot.textContent = itemData.textContent; // PDF生成用にtextContentも更新
                            // テキストエリアの高さ自動調整
                            textarea.style.height = 'auto';
                            textarea.style.height = (textarea.scrollHeight) + 'px';
                        }
                        console.log(`[loadSetlistState] Filled text slot ${itemData.slotIndex} with "${itemData.textContent}"`);
                    } else {
                        // 曲アイテムの復元
                        console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                        fillSlotWithItem(targetSlot, itemData);

                        const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
                        if (albumItemInMenu) {
                            albumItemInMenu.style.visibility = 'hidden';
                            originalAlbumMap.set(itemData.itemId, albumItemInMenu);
                            console.log(`[loadSetlistState] Hid album item in menu: ${itemData.itemId}`);
                        }
                    }
                } else {
                    console.warn(`[loadSetlistState] Target slot not found for index: ${itemData.slotIndex}`);
                }
            });

            // メニューとアルバムの開閉状態を復元
            if (menu) { // menu要素が存在するか確認
                if (state.menuOpen) {
                  menu.classList.add('open');
                  if (menuButton) menuButton.classList.add('open');
                } else {
                  menu.classList.remove('open');
                  if (menuButton) menuButton.classList.remove('open');
                }
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
      console.log("[loadSetlistState] No shareId found in URL. Loading default state (today's date).");
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