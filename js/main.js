// main.js

// --- グローバル変数と定数の定義 ---
// DOM要素の参照
const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const hamburgerMenu = document.getElementById("hamburgerMenu"); // ハンバーガーメニューアイコン
const clearSetlistButton = document.getElementById("clearSetlist");
const shareSetlistButton = document.getElementById("shareSetlist");
const generatePdfButton = document.getElementById("generatePdf");
const messageBox = document.getElementById("messageBox");
const albumSection = document.getElementById("albumSection"); // アルバムセクション
const albumToggleButtons = document.querySelectorAll(".album-toggle"); // アルバムの開閉ボタン

// Firebase関連 (SDKがグローバルにロードされていることを前提)
// Firebase SDKがHTMLで読み込まれていることを確認してください
const database = typeof firebase !== 'undefined' && firebase.database ? firebase.database() : null;

const maxSongs = 20; // セットリストの最大曲数

// ドラッグ&ドロップ関連
let draggedItem = null;
let lastTapTime = 0;
let touchTimeout = null;

// アルバムのオリジナルアイテムの状態を追跡するMap
// キー: album-content の ID (例: 'album1'), 値: そのアルバム内の初期アイテムのHTMLスナップショット
const originalAlbumMap = new Map();

// --- ヘルパー関数 ---

/**
 * メッセージボックスを表示する
 * @param {string} message - 表示するメッセージ
 * @param {number} duration - 表示時間（ミリ秒、デフォルトは3000ms）
 */
function showMessageBox(message, duration = 3000) {
    if (!messageBox) {
        console.warn("[showMessageBox] messageBox element not found.");
        return;
    }
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    messageBox.classList.add('show');
    clearTimeout(messageBox.hideTimeout); // 既存の非表示タイマーをクリア
    messageBox.hideTimeout = setTimeout(() => {
        messageBox.classList.remove('show');
        // アニメーション終了後にdisplay: noneを設定
        messageBox.addEventListener('transitionend', function handler() {
            if (!messageBox.classList.contains('show')) {
                messageBox.style.display = 'none';
                messageBox.removeEventListener('transitionend', handler);
            }
        });
    }, duration);
}

/**
 * スロット内のコンテンツをクリアし、初期状態に戻す
 * @param {HTMLElement} slot - クリアするセットリストスロット要素
 */
function clearSlotContent(slot) {
    if (!slot) {
        console.error("[clearSlotContent] Slot is null or undefined.");
        return;
    }
    const slotIndex = slot.dataset.slotIndex;
    console.log(`[clearSlotContent] Clearing slot ${slotIndex}`);

    // ドラッグアンドドロップイベントリスナーを削除
    slot.removeEventListener('dragstart', handleDragStart);
    slot.removeEventListener('touchstart', handleTouchStart);
    slot.removeEventListener('touchmove', handleTouchMove);
    slot.removeEventListener('touchend', handleTouchEnd);
    slot.removeEventListener('dblclick', handleDoubleClickSlot);
    
    // スロットのクラスとデータ属性をリセット
    slot.classList.remove('setlist-item', 'setlist-slot-text', 'short', 'se-active', 'drumsolo-active');
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
    
    // 中身を空にする
    slot.innerHTML = ''; 

    // "+" ボタンを追加
    const plusButton = document.createElement('button');
    plusButton.textContent = '+';
    plusButton.classList.add('add-text-slot-button');
    plusButton.title = 'カスタムテキストを追加';
    plusButton.addEventListener('click', () => createTextInputSlot(slot));
    slot.appendChild(plusButton);

    console.log(`[clearSlotContent] Slot ${slotIndex} cleared and '+' button added.`);
}

/**
 * セットリスト内のアイテムのデータを取得する
 * @param {HTMLElement} slot - セットリストのスロット要素
 * @returns {object|null} アイテムのデータオブジェクト、またはnull
 */
function getSlotItemData(slot) {
    if (!slot) return null;

    if (slot.classList.contains('setlist-item')) {
        return {
            type: 'song', // タイプを追加
            itemId: slot.dataset.itemId,
            name: slot.dataset.name,
            rGt: slot.dataset.rGt,
            lGt: slot.dataset.lGt,
            bass: slot.dataset.bass,
            bpm: slot.dataset.bpm,
            chorus: slot.dataset.chorus,
            short: slot.dataset.short === 'true',
            seChecked: slot.dataset.seChecked === 'true',
            drumsoloChecked: slot.dataset.drumsoloChecked === 'true'
        };
    } else if (slot.classList.contains('setlist-slot-text')) {
        return {
            type: 'text', // タイプを追加
            textContent: slot.textContent.trim()
        };
    }
    return null;
}

/**
 * セットリストを現在の状態に基づいて取得する
 * @returns {object} 現在のセットリストの状態を表すオブジェクト
 */
function getCurrentState() {
    const setlistItems = [];
    document.querySelectorAll("#setlist .setlist-slot").forEach((slot, index) => {
        const itemData = getSlotItemData(slot);
        if (itemData) {
            if (itemData.type === 'song') {
                setlistItems.push({ type: 'song', slotIndex: index, data: itemData });
            } else if (itemData.type === 'text') {
                setlistItems.push({ type: 'text', slotIndex: index, textContent: itemData.textContent });
            }
        } else {
            // 空のスロットも状態として保持し、UIでクリアできるようにする
            setlistItems.push({ type: 'empty', slotIndex: index });
        }
    });

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');
    const setlistVenue = document.getElementById('setlistVenue');

    const yearVal = setlistYear ? setlistYear.value : '';
    const monthVal = setlistMonth ? setlistMonth.value : '';
    const dayVal = setlistDay ? setlistDay.value : '';
    const venueVal = setlistVenue ? setlistVenue.value : '';

    const setlistDate = (yearVal && monthVal && dayVal) ? 
                         `${yearVal}-${monthVal}-${dayVal}` : '';

    const openAlbums = [];
    document.querySelectorAll('.album-content.active').forEach(album => {
        openAlbums.push(album.id);
    });

    return {
        setlist: setlistItems,
        setlistDate: setlistDate,
        setlistVenue: venueVal,
        originalAlbumMap: Object.fromEntries(originalAlbumMap), // MapをObjectに変換して保存
        menuOpen: menu ? menu.classList.contains('open') : false,
        openAlbums: openAlbums
    };
}

/**
 * アルバムアイテムをセットリストスロットに埋める
 * @param {HTMLElement} targetSlot - アイテムを埋める対象のスロット
 * @param {object} itemData - アイテムのデータ
 * @param {boolean} [fromDrop=false] - ドラッグ&ドロップによるものか（元の要素を隠す処理を行うか）
 */
function fillSlotWithItem(targetSlot, itemData, fromDrop = false) {
    if (!targetSlot || !itemData) {
        console.error("[fillSlotWithItem] Target slot or itemData is null or undefined.");
        return;
    }

    // スロットの既存内容をクリア（テキスト入力モードを解除するため）
    clearSlotContent(targetSlot);
    targetSlot.innerHTML = ''; // '+' ボタンもここで消す

    // クラスとデータ属性を設定
    targetSlot.classList.add('setlist-item');
    targetSlot.dataset.itemId = itemData.itemId;
    targetSlot.dataset.name = itemData.name;
    targetSlot.dataset.rGt = itemData.rGt || '';
    targetSlot.dataset.lGt = itemData.lGt || '';
    targetSlot.dataset.bass = itemData.bass || '';
    targetSlot.dataset.bpm = itemData.bpm || '';
    targetSlot.dataset.chorus = itemData.chorus || '';
    targetSlot.dataset.short = itemData.short ? 'true' : 'false';
    targetSlot.dataset.seChecked = itemData.seChecked ? 'true' : 'false';
    targetSlot.dataset.drumsoloChecked = itemData.drumsoloChecked ? 'true' : 'false';

    // 内部HTMLを生成
    targetSlot.innerHTML = `
        <div class="item-display">
            <span class="item-title">${itemData.name}</span>
            <div class="item-details">
                ${itemData.rGt ? `<span>R.Gt: ${itemData.rGt}</span>` : ''}
                ${itemData.lGt ? `<span>L.Gt: ${itemData.lGt}</span>` : ''}
                ${itemData.bass ? `<span>Bass: ${itemData.bass}</span>` : ''}
                ${itemData.bpm ? `<span>BPM: ${itemData.bpm}</span>` : ''}
                ${itemData.chorus ? `<span>コーラス: ${itemData.chorus}</span>` : ''}
            </div>
            <div class="item-options">
                <label><input type="checkbox" data-option-type="short" ${itemData.short ? 'checked' : ''}> Short</label>
                <label><input type="checkbox" data-option-type="se" ${itemData.seChecked ? 'checked' : ''}> SE有り</label>
                <label><input type="checkbox" data-option-type="drumsolo" ${itemData.drumsoloChecked ? 'checked' : ''}> ドラムソロ有り</label>
            </div>
        </div>
        <button class="remove-item-button">×</button>
    `;

    // オプションのチェックボックスの状態をクラスに反映
    if (itemData.short) targetSlot.classList.add('short');
    if (itemData.seChecked) targetSlot.classList.add('se-active');
    if (itemData.drumsoloChecked) targetSlot.classList.add('drumsolo-active');

    // ×ボタンにイベントリスナーを追加
    const removeButton = targetSlot.querySelector('.remove-item-button');
    if (removeButton) {
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 親要素のクリックイベントが発火しないようにする
            const itemIdToRemove = targetSlot.dataset.itemId;
            clearSlotContent(targetSlot); // スロットをクリア
            // メニュー内の元のアイテムを再表示
            const originalItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemIdToRemove}"]`);
            if (originalItemInMenu) {
                originalItemInMenu.style.visibility = ''; // 非表示を解除
                console.log(`[fillSlotWithItem] Restored visibility of album item: ${itemIdToRemove}`);
            }
            showMessageBox("スロットをクリアしました。");
        });
    }

    // ドラッグアンドドロップイベントを再設定
    enableDragAndDrop(targetSlot);
    // ダブルクリック/タップイベントも再設定
    targetSlot.addEventListener('dblclick', handleDoubleClickSlot);
    targetSlot.addEventListener('touchstart', handleTouchStart, { passive: true });
    targetSlot.addEventListener('touchmove', handleTouchMove, { passive: true }); // passiveを追加
    targetSlot.addEventListener('touchend', handleTouchEnd);


    // ドラッグ＆ドロップによる追加の場合、元のアイテムを隠す
    if (fromDrop) {
        const originalItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
        if (originalItemInMenu) {
            originalItemInMenu.style.visibility = 'hidden';
            console.log(`[fillSlotWithItem] Hid album item in menu: ${itemData.itemId}`);
        }
    }
    console.log(`[fillSlotWithItem] Slot ${targetSlot.dataset.slotIndex} filled with item: ${itemData.name}`);
}


/**
 * スロットをカスタムテキスト入力モードにする
 * @param {HTMLElement} slot - テキスト入力モードにするスロット要素
 */
function createTextInputSlot(slot) {
    if (!slot) {
        console.error("[createTextInputSlot] Slot is null or undefined.");
        return;
    }
    console.log(`[createTextInputSlot] Converting slot ${slot.dataset.slotIndex} to text input mode.`);
    clearSlotContent(slot); // まず既存の内容をクリア

    slot.classList.add('setlist-slot-text'); // テキストスロット用のクラスを追加
    slot.removeAttribute('data-item-id'); // 曲アイテムのデータ属性を削除

    const currentText = slot.textContent.trim(); // 現在のテキストコンテンツを取得

    slot.innerHTML = `
        <input type="text" class="text-input-field" placeholder="カスタムテキストを入力" value="${currentText}">
        <button class="save-text-button">保存</button>
        <button class="cancel-text-button">キャンセル</button>
    `;

    const inputField = slot.querySelector('.text-input-field');
    const saveButton = slot.querySelector('.save-text-button');
    const cancelButton = slot.querySelector('.cancel-text-button');

    if (inputField) inputField.focus();

    // 保存ボタンのイベントリスナー
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const text = inputField ? inputField.value.trim() : '';
            if (text) {
                slot.textContent = text;
                slot.classList.add('setlist-slot-text'); // 保存後もテキストスロットのクラスを維持
                console.log(`[createTextInputSlot] Text saved in slot ${slot.dataset.slotIndex}: "${text}"`);
            } else {
                // テキストが空の場合、スロットを完全にクリア
                clearSlotContent(slot);
                console.log(`[createTextInputSlot] Text empty. Slot ${slot.dataset.slotIndex} cleared.`);
            }
            // ドラッグ＆ドロップイベントを再設定
            enableDragAndDrop(slot); // テキストスロット自体もドラッグできるように
            slot.addEventListener('dblclick', handleDoubleClickSlot); // ダブルクリックで再編集できるように
        });
    }

    // キャンセルボタンのイベントリスナー
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            // キャンセル時は元の状態（＋ボタンのある空スロット）に戻す
            clearSlotContent(slot);
            console.log(`[createTextInputSlot] Text input cancelled for slot ${slot.dataset.slotIndex}.`);
        });
    }

    // Enterキーでも保存できるように
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (saveButton) saveButton.click(); // 保存ボタンのクリックイベントをトリガー
            }
        });
    }

    // スロットのドラッグイベントを一時的に無効化
    slot.removeEventListener('dragstart', handleDragStart);
    slot.removeEventListener('touchstart', handleTouchStart);
    slot.removeEventListener('touchmove', handleTouchMove);
    slot.removeEventListener('touchend', handleTouchEnd);
    slot.removeEventListener('dblclick', handleDoubleClickSlot); // 二重起動防止
}

/**
 * メニュー内のセットリストアイテムを隠す関数
 * (ロード時や初期化時に、すでにセットリストにあるアイテムをメニューから非表示にする)
 */
function hideSetlistItemsInMenu() {
    const setlistItems = document.querySelectorAll("#setlist .setlist-item");
    const menuItems = document.querySelectorAll(".album-content .item");

    const setlistItemIds = new Set();
    setlistItems.forEach(item => {
        if (item.dataset.itemId) {
            setlistItemIds.add(item.dataset.itemId);
        }
    });

    menuItems.forEach(menuItem => {
        if (setlistItemIds.has(menuItem.dataset.itemId)) {
            menuItem.style.visibility = 'hidden';
            console.log(`[hideSetlistItemsInMenu] Hid menu item: ${menuItem.dataset.itemId}`);
        }
    });
    console.log("[hideSetlistItemsInMenu] Finished hiding setlist items in menu.");
}

/**
 * jsPDF-AutoTableで日本語フォントを使用できるように登録する
 * @param {jsPDF} doc - jsPDFのインスタンス
 */
function registerJapaneseFont(doc) {
    // NotoSansJP-Regular.ttf のBase64エンコードデータを使用 (事前に外部ファイルから読み込むか、ここに直接記述)
    // 通常は registerFont 関数内で定義されたバイトデータが使用されます。
    // 例: doc.addFileToVFS('NotoSansJP-Regular-normal.ttf', fontBase64Data);
    //     doc.addFont('NotoSansJP-Regular-normal.ttf', 'NotoSansJP', 'normal');
    //     doc.addFont('NotoSansJP-Regular-bold.ttf', 'NotoSansJP', 'bold'); // 太字もあれば
    //
    // もし addFont の呼び出しだけでエラーが出る場合、
    // フォントデータ自体がjsPDFに埋め込まれていない可能性があります。
    // jsPDF-AutoTableの日本語対応のためには、別途フォントファイルをjsPDFに登録する処理が必要です。
    // 具体的には、NotoSansJPのttfファイルをBase64エンコードし、
    // `doc.addFileToVFS` と `doc.addFont` で登録します。
    // これは環境構築の範疇となるため、ここでは基本的な呼び出しのみを記述します。
    // 
    // サンプルのためにダミーのフォント登録を示しますが、
    // 実際のアプリケーションでは、jsPDFとjspdf-autotableの公式ドキュメントを参照し、
    // 日本語フォントを正しく埋め込むための手順に従ってください。
    // 例:
    // doc.addFont('path/to/your/NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    // doc.addFont('path/to/your/NotoSansJP-Bold.ttf', 'NotoSansJP', 'bold');

    // 暫定的な対応 (実際のフォント埋め込みが必要です)
    // Noto Sans JPが事前にVFSに登録されていることを前提とする
    // もしエラーが出る場合は、この部分にフォント登録の具体的なコード（base64データなど）を記述してください。
    doc.setFont('NotoSansJP', 'normal');
    doc.setFont('NotoSansJP', 'bold'); // Boldも使用する場合
    console.log("[registerJapaneseFont] Attempted to set NotoSansJP font.");
}


// --- イベントハンドラー ---

/**
 * ドラッグ&ドロップイベントを有効にする
 * @param {HTMLElement} element - ドラッグ可能またはドロップ可能にする要素
 */
function enableDragAndDrop(element) {
    if (!element) {
        console.warn("[enableDragAndDrop] Element is null or undefined.");
        return;
    }
    element.setAttribute('draggable', 'true');

    // 既存のイベントリスナーがあれば削除してから追加（重複登録防止）
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('drop', handleDrop);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('dragenter', handleDragEnter);

    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);

    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragenter', handleDragEnter);

    // モバイルタッチイベント
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    console.log(`[enableDragAndDrop] Drag and drop enabled for element: ${element.id || element.className}`);
}

function handleDragStart(e) {
    draggedItem = e.target;
    // dataTransfer.setDataは必須（Firefox対策）
    e.dataTransfer.setData('text/plain', e.target.dataset.itemId || e.target.textContent);
    e.dataTransfer.effectAllowed = 'move'; // 移動を許可
    console.log(`[DragStart] Dragging: ${draggedItem.id || draggedItem.className}`);

    // ドラッグ中の要素にクラスを追加（スタイル用）
    setTimeout(() => {
        if (draggedItem) draggedItem.classList.add('dragging');
    }, 0); // DOM更新を少し遅らせる
}

function handleDragOver(e) {
    e.preventDefault(); // デフォルトの動作（ドロップ禁止）をキャンセル
    e.dataTransfer.dropEffect = 'move';
    // ドロップターゲットにスタイルを追加
    if (e.target.classList.contains('setlist-slot') && !e.target.classList.contains('drag-over')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.classList.contains('setlist-slot')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    // スロットからカーソルが離れたらスタイルを削除
    if (e.target.classList.contains('setlist-slot')) {
        e.target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over'); // スタイルを削除

    if (!draggedItem) return;

    const targetSlot = e.target.closest('.setlist-slot');
    if (!targetSlot) return; // スロット以外の場所にドロップされた場合

    console.log(`[Drop] Dropped ${draggedItem.id || draggedItem.className} onto ${targetSlot.dataset.slotIndex}`);

    if (draggedItem.classList.contains('setlist-item') || draggedItem.classList.contains('setlist-slot-text')) {
        // セットリスト内のアイテムの並べ替え
        const originalParent = draggedItem.parentNode;
        const targetParent = targetSlot.parentNode;

        if (originalParent === targetParent && draggedItem !== targetSlot) {
            // 同じセットリスト内で並べ替え
            const originalIndex = Array.from(originalParent.children).indexOf(draggedItem);
            const targetIndex = Array.from(targetParent.children).indexOf(targetSlot);

            if (originalIndex < targetIndex) {
                targetParent.insertBefore(draggedItem, targetSlot.nextSibling);
            } else {
                targetParent.insertBefore(draggedItem, targetSlot);
            }
            console.log(`[Drop] Reordered items from ${originalIndex} to ${targetIndex}`);
            showMessageBox("セットリストの順序を変更しました。");
        } else if (draggedItem !== targetSlot) {
            // 異なるスロット間で交換
            const draggedItemData = getSlotItemData(draggedItem);
            const targetSlotData = getSlotItemData(targetSlot);

            // ドラッグ元のスロットをクリア
            clearSlotContent(draggedItem);

            // ドロップ先に元のアイテムを埋める
            if (draggedItemData && draggedItemData.type === 'text') { // テキストアイテムの場合
                // 一度クリアしているので、inputフィールドを再生成し、テキストをセットして保存をトリガー
                createTextInputSlot(targetSlot);
                const inputField = targetSlot.querySelector('input[type="text"]');
                if(inputField) inputField.value = draggedItemData.textContent;
                const saveBtn = targetSlot.querySelector('.save-text-button');
                if (saveBtn) saveBtn.click(); // 自動保存
            } else if (draggedItemData && draggedItemData.type === 'song') { // 曲アイテムの場合
                fillSlotWithItem(targetSlot, draggedItemData.data); // dataプロパティからデータを渡す
            }

            // ドロップ元にドロップ先のアイテムを埋め戻す
            if (targetSlotData) {
                if (targetSlotData.type === 'text') {
                    // 同様に、inputフィールドを再生成し、テキストをセットして保存をトリガー
                    createTextInputSlot(draggedItem);
                    const inputField = draggedItem.querySelector('input[type="text"]');
                    if(inputField) inputField.value = targetSlotData.textContent;
                    const saveBtn = draggedItem.querySelector('.save-text-button');
                    if (saveBtn) saveBtn.click(); // 自動保存
                } else if (targetSlotData.type === 'song') {
                    fillSlotWithItem(draggedItem, targetSlotData.data);
                }
            } else {
                // ドロップ先が元々空だった場合、ドラッグ元をクリアしたままにする
            }
            showMessageBox("アイテムを交換しました。");
            console.log("[Drop] Swapped items between slots.");
        }
    } else if (draggedItem.classList.contains('item')) {
        // アルバムアイテムをセットリストスロットにドロップ
        const itemId = draggedItem.dataset.itemId;
        const itemName = draggedItem.dataset.name;
        const itemRGt = draggedItem.dataset.rGt;
        const itemLGt = draggedItem.dataset.lGt;
        const itemBass = draggedItem.dataset.bass;
        const itemBpm = draggedItem.dataset.bpm;
        const itemChorus = draggedItem.dataset.chorus;

        // ドロップ先のスロットが既に曲で埋まっている場合、その曲をメニューに戻す
        if (targetSlot.classList.contains('setlist-item')) {
            const existingItemId = targetSlot.dataset.itemId;
            const existingItemInMenu = document.querySelector(`.album-content .item[data-item-id="${existingItemId}"]`);
            if (existingItemInMenu) {
                existingItemInMenu.style.visibility = '';
                console.log(`[Drop] Returned existing item ${existingItemId} to menu.`);
            }
        }
        
        // 新しいアイテムをスロットに埋める
        fillSlotWithItem(targetSlot, { 
            itemId: itemId, 
            name: itemName, 
            rGt: itemRGt, 
            lGt: itemLGt, 
            bass: itemBass, 
            bpm: itemBpm, 
            chorus: itemChorus,
            short: false, // デフォルトでfalse
            seChecked: false, // デフォルトでfalse
            drumsoloChecked: false // デフォルトでfalse
        }, true); // fromDrop = true

        showMessageBox(`${itemName} をセットリストに追加しました！`);
        console.log(`[Drop] Added album item ${itemName} to slot ${targetSlot.dataset.slotIndex}`);
    }

    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
}

function handleDragEnd(e) {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    console.log("[DragEnd] Drag operation finished.");
}

// モバイル用タッチイベント
function handleTouchStart(e) {
    // e.preventDefault(); // これを有効にするとスクロールができなくなるので注意
    draggedItem = e.target.closest('.item, .setlist-slot');
    if (!draggedItem) return;

    // テキスト入力フィールドがフォーカスされている場合はドラッグを開始しない
    if (e.target.classList.contains('text-input-field')) {
        return;
    }

    // タップ時間の記録（ダブルタップ判定用）
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < 300 && tapLength > 0) { // 300ms以内ならダブルタップ
        console.log("[TouchStart] Double tap detected.");
        if (draggedItem.classList.contains('setlist-slot') && !draggedItem.classList.contains('setlist-item')) {
            createTextInputSlot(draggedItem); // 空スロットをダブルタップでテキスト入力モードに
        } else if (draggedItem.classList.contains('setlist-slot-text')) {
             // 既にテキストスロットなら編集モードにする
            createTextInputSlot(draggedItem);
        } else if (draggedItem.classList.contains('setlist-item')) {
            // 曲アイテムをダブルタップでクリア
            const itemIdToRemove = draggedItem.dataset.itemId;
            clearSlotContent(draggedItem);
            const originalItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemIdToRemove}"]`);
            if (originalItemInMenu) {
                originalItemInMenu.style.visibility = ''; // 非表示を解除
            }
            showMessageBox("スロットをクリアしました。");
        }
        clearTimeout(touchTimeout); // シングルタップのタイマーをクリア
        touchTimeout = null;
        lastTapTime = 0; // ダブルタップ後、時間をリセット
        return; // ダブルタップ処理が完了したので、これ以上は進まない
    } else {
        lastTapTime = currentTime;
        touchTimeout = setTimeout(() => {
            lastTapTime = 0;
            touchTimeout = null;
        }, 300); // 300ms後にタップ時間をリセット
    }

    // 長押しでドラッグ開始
    touchTimeout = setTimeout(() => {
        if (draggedItem) { // draggedItemがまだ存在することを確認
            draggedItem.classList.add('dragging-touch'); // タッチ用スタイル
            console.log(`[TouchStart] Long press detected. Dragging: ${draggedItem.id || draggedItem.className}`);
            // モバイルではdataTransferは使えないので、位置を追跡
        }
    }, 500); // 500msの長押しでドラッグ開始
}

function handleTouchMove(e) {
    if (touchTimeout) {
        clearTimeout(touchTimeout); // 長押し開始前の移動でタイマーをキャンセル
        touchTimeout = null;
        lastTapTime = 0; // ダブルタップ判定もリセット
    }

    if (draggedItem && draggedItem.classList.contains('dragging-touch')) {
        // ドラッグ中の要素を指の位置に追従させる（視覚的なフィードバック）
        const touch = e.touches[0];
        if (touch) {
            draggedItem.style.position = 'fixed';
            draggedItem.style.zIndex = '1000';
            // スクロールを考慮して位置を調整
            draggedItem.style.left = `${touch.clientX - draggedItem.offsetWidth / 2}px`;
            draggedItem.style.top = `${touch.clientY - draggedItem.offsetHeight / 2}px`;
        }

        // ドロップ先のハイライト（最も近いスロットをハイライト）
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
            slot.classList.remove('drag-over');
        });
        const targetSlot = targetElement ? targetElement.closest('.setlist-slot') : null;
        if (targetSlot) {
            targetSlot.classList.add('drag-over');
        }
    }
}

function handleTouchEnd(e) {
    if (touchTimeout) {
        clearTimeout(touchTimeout); // 長押しタイマーが残っていればクリア
        touchTimeout = null;
    }

    if (draggedItem && draggedItem.classList.contains('dragging-touch')) {
        draggedItem.classList.remove('dragging-touch');
        draggedItem.style.position = ''; // スタイルをリセット
        draggedItem.style.zIndex = '';
        draggedItem.style.left = '';
        draggedItem.style.top = '';

        const touch = e.changedTouches[0];
        if (touch) {
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetSlot = targetElement ? targetElement.closest('.setlist-slot') : null;

            if (targetSlot) {
                // ドロップ処理を実行
                // handleDropのロジックをここで再現または呼び出す
                console.log(`[TouchEnd] Dropped ${draggedItem.id || draggedItem.className} onto ${targetSlot.dataset.slotIndex}`);

                if (draggedItem.classList.contains('setlist-item') || draggedItem.classList.contains('setlist-slot-text')) {
                    // セットリスト内のアイテムの並べ替え
                    const originalParent = draggedItem.parentNode;
                    const targetParent = targetSlot.parentNode;

                    if (originalParent === targetParent && draggedItem !== targetSlot) {
                        const originalIndex = Array.from(originalParent.children).indexOf(draggedItem);
                        const targetIndex = Array.from(targetParent.children).indexOf(targetSlot);

                        if (originalIndex < targetIndex) {
                            targetParent.insertBefore(draggedItem, targetSlot.nextSibling);
                        } else {
                            targetParent.insertBefore(draggedItem, targetSlot);
                        }
                        showMessageBox("セットリストの順序を変更しました。");
                    } else if (draggedItem !== targetSlot) {
                        // 異なるスロット間で交換（今回は単純に上書き）
                        const draggedItemData = getSlotItemData(draggedItem);
                        const targetSlotData = getSlotItemData(targetSlot);
            
                        clearSlotContent(draggedItem); // ドラッグ元のスロットをクリア

                        // ドロップ先に元のアイテムを埋める
                        if (draggedItemData && draggedItemData.type === 'text') {
                            createTextInputSlot(targetSlot);
                            const inputField = targetSlot.querySelector('input[type="text"]');
                            if(inputField) inputField.value = draggedItemData.textContent;
                            const saveBtn = targetSlot.querySelector('.save-text-button');
                            if (saveBtn) saveBtn.click();
                        } else if (draggedItemData && draggedItemData.type === 'song') {
                            fillSlotWithItem(targetSlot, draggedItemData.data);
                        }

                        // ドロップ元にドロップ先のアイテムを埋め戻す
                        if (targetSlotData) {
                            if (targetSlotData.type === 'text') {
                                createTextInputSlot(draggedItem);
                                const inputField = draggedItem.querySelector('input[type="text"]');
                                if(inputField) inputField.value = targetSlotData.textContent;
                                const saveBtn = draggedItem.querySelector('.save-text-button');
                                if (saveBtn) saveBtn.click();
                            } else if (targetSlotData.type === 'song') {
                                fillSlotWithItem(draggedItem, targetSlotData.data);
                            }
                        }
                        showMessageBox("アイテムを交換しました。");
                    }
                } else if (draggedItem.classList.contains('item')) {
                    // アルバムアイテムをセットリストスロットにドロップ
                    const itemId = draggedItem.dataset.itemId;
                    const itemName = draggedItem.dataset.name;
                    const itemRGt = draggedItem.dataset.rGt;
                    const itemLGt = draggedItem.dataset.lGt;
                    const itemBass = draggedItem.dataset.bass;
                    const itemBpm = draggedItem.dataset.bpm;
                    const itemChorus = draggedItem.dataset.chorus;

                    if (targetSlot.classList.contains('setlist-item')) {
                        const existingItemId = targetSlot.dataset.itemId;
                        const existingItemInMenu = document.querySelector(`.album-content .item[data-item-id="${existingItemId}"]`);
                        if (existingItemInMenu) {
                            existingItemInMenu.style.visibility = '';
                        }
                    }
                    
                    fillSlotWithItem(targetSlot, { 
                        itemId: itemId, 
                        name: itemName, 
                        rGt: itemRGt, 
                        lGt: itemLGt, 
                        bass: itemBass, 
                        bpm: itemBpm, 
                        chorus: itemChorus,
                        short: false, 
                        seChecked: false, 
                        drumsoloChecked: false 
                    }, true);

                    showMessageBox(`${itemName} をセットリストに追加しました！`);
                }
            } else {
                console.log("[TouchEnd] Dropped outside a valid slot.");
                // スロット外にドロップされた場合、元の位置に戻すなど
            }
        }
    }
    // スタイルをリセット
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    draggedItem = null;
    console.log("[TouchEnd] Touch operation finished.");
}

function handleDoubleClickSlot(e) {
    const targetSlot = e.target.closest('.setlist-slot');
    if (!targetSlot) return;

    if (targetSlot.classList.contains('setlist-item')) {
        // 曲アイテムをダブルクリックでクリア
        const itemIdToRemove = targetSlot.dataset.itemId;
        clearSlotContent(targetSlot);
        const originalItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemIdToRemove}"]`);
        if (originalItemInMenu) {
            originalItemInMenu.style.visibility = ''; // 非表示を解除
        }
        showMessageBox("スロットをクリアしました。");
    } else if (targetSlot.classList.contains('setlist-slot-text')) {
        // テキストスロットをダブルクリックで編集モードに
        createTextInputSlot(targetSlot);
    } else {
        // 空のスロットをダブルクリックでテキスト入力モードに
        createTextInputSlot(targetSlot);
    }
}

/**
 * ハンバーガーメニューの開閉を切り替える関数
 */
function toggleMenu() {
    // グローバル変数として既に取得されているはずだが、念のため再確認
    const currentMenu = document.getElementById("menu");
    const currentHamburgerMenu = document.getElementById("hamburgerMenu");

    if (currentMenu && currentHamburgerMenu) {
        currentMenu.classList.toggle('open');
        currentHamburgerMenu.classList.toggle('open');
        console.log(`[toggleMenu] Menu state toggled. Menu open: ${currentMenu.classList.contains('open')}`);
    } else {
        console.warn("[toggleMenu] Menu or hamburgerMenu element not found at toggle time.");
    }
}

/**
 * セットリストをクリアする
 */
function clearSetlist() {
    console.log("[clearSetlist] Clearing all setlist slots.");
    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");
    setlistSlots.forEach(slot => {
        clearSlotContent(slot);
    });

    // アルバムアイテムの表示状態をリセット
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.visibility = '';
    });
    // originalAlbumMap をクリア
    originalAlbumMap.clear();

    showMessageBox("セットリストをすべてクリアしました！");
    console.log("[clearSetlist] All slots cleared and album items restored.");
}


/**
 * セットリストの状態をFirebaseに保存し、共有可能なURLを生成する
 */
async function shareSetlist() {
    showMessageBox("共有URLを生成中...");
    console.log("[shareSetlist] Starting share process.");

    if (!database) { // databaseがnullかどうかを確認
        showMessageBox('Firebaseが初期化されていません。開発者ツールでエラーを確認してください。');
        console.error('Firebase is not initialized or firebase.database is not available.');
        return;
    }

    const stateToSave = getCurrentState();
    console.log("[shareSetlist] State to save:", stateToSave);

    try {
        const newSetlistRef = database.ref('setlists').push(); // 新しいユニークなIDを生成
        await newSetlistRef.set(stateToSave);
        const shareId = newSetlistRef.key; // 生成されたIDを取得

        const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

        // クリップボードにコピー
        await navigator.clipboard.writeText(shareUrl);
        showMessageBox("共有URLをクリップボードにコピーしました！");
        console.log("[shareSetlist] Share URL copied:", shareUrl);

        // URLをアドレスバーに表示（オプション）
        // window.history.pushState({ path: shareUrl }, '', shareUrl);

    } catch (error) {
        console.error("共有URLの生成に失敗しました:", error);
        showMessageBox("共有URLの生成に失敗しました。");
    }
}

/**
 * セットリストのPDFを生成し、共有またはダウンロードする。
 * 提供されたPDF形式（テーブル形式）に似たレイアウトで生成し、日本語に対応。
 * jsPDF-AutoTableを使用する。
 */
async function generateSetlistPdf() {
    showMessageBox("PDFを生成中...");
    console.log("[generateSetlistPdf] PDF generation started.");

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');
    const setlistVenue = document.getElementById('setlistVenue');

    const yearVal = setlistYear ? setlistYear.value : '';
    const monthVal = setlistMonth ? setlistMonth.value : '';
    const dayVal = setlistDay ? setlistDay.value : '';
    const venueVal = setlistVenue ? setlistVenue.value : '';

    let headerText = '';
    if (yearVal && monthVal && dayVal) {
        headerText += `${yearVal}/${parseInt(monthVal)}/${parseInt(dayVal)}`;
    }
    if (venueVal) {
        if (headerText) headerText += ' ';
        headerText += venueVal;
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
            const songData = itemState.data; // itemState.dataからデータを取得
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
                tableBody.push(['', textContent, '', '', '', '', '']); // No.を空に
                // シンプルPDF用の行 (テキストスロットはNo.なし、連番を振らずに追加)
                simplePdfBody.push(`${simpleItemNo}. ${textContent} (カスタム)`); // カスタムテキストも連番を振る
                simpleItemNo++; 
            }
        } else {
            // 空のスロットはPDFに表示しない、またはPlaceholderとして表示することも可能
            console.log(`[generateSetlistPdf] Skipping empty slot at index ${itemState.slotIndex} for PDF generation.`);
        }
    }

    try {
        const { jsPDF } = window.jspdf;
        if (typeof jsPDF === 'undefined') {
            throw new Error("jsPDF library not found. Please ensure it is loaded.");
        }

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
        if (yearVal && monthVal && dayVal) {
            detailedFilename += `_${yearVal}-${monthVal}-${dayVal}`;
        }
        if (venueVal) {
            detailedFilename += `_${venueVal}`;
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
        if (yearVal && monthVal && dayVal) {
            simpleFilename += `_${yearVal}-${monthVal}-${dayVal}`;
        }
        if (venueVal) {
            simpleFilename += `_${venueVal}`;
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

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');
    const setlistVenue = document.getElementById('setlistVenue');

    if (shareId) {
      if (!database) { // databaseがnullかどうかを確認
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

            // 日付の復元
            if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                const dateParts = state.setlistDate.split('-'); 
                if (dateParts.length === 3) {
                    setlistYear.value = dateParts[0];
                    setlistMonth.value = dateParts[1];
                    // 月を変更したら日にちを更新
                    if (setlistMonth) {
                        const event = new Event('change');
                        setlistMonth.dispatchEvent(event);
                    }
                    setlistDay.value = dateParts[2];
                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                    // 無効な形式の場合はデフォルト日付を設定
                    initializeDefaultDate();
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found. Initializing to today.");
                initializeDefaultDate();
            }
            // 会場の復元
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            // セットリストアイテムの復元
            state.setlist.forEach(itemState => {
                const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemState.slotIndex}"]`);
                if (!targetSlot) {
                    console.warn(`[loadSetlistState] Target slot not found for index: ${itemState.slotIndex}. Skipping item restoration.`);
                    return;
                }

                if (itemState.type === 'text') {
                    createTextInputSlot(targetSlot);
                    targetSlot.textContent = itemState.textContent;
                    const inputElement = targetSlot.querySelector('input[type="text"]');
                    if (inputElement) {
                        inputElement.value = itemState.textContent;
                        // 保存ボタンがあればクリックして確定させる
                        const saveBtn = targetSlot.querySelector('.save-text-button');
                        if (saveBtn) saveBtn.click();
                        console.log(`[loadSetlistState] Filled text slot ${itemState.slotIndex} with "${itemState.textContent}"`);
                    } else {
                        console.warn(`[loadSetlistState] Text input element not found for slot ${itemState.slotIndex}.`);
                    }
                } else if (itemState.type === 'song') {
                    const itemData = itemState.data;
                    console.log(`[loadSetlistState] Filling slot ${itemState.slotIndex} with song ID: ${itemData.itemId}`);
                    fillSlotWithItem(targetSlot, itemData);

                    // クラスはfillSlotWithItem内で設定されるため、重複は不要だが、念のため状態を反映
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
            if (menu && hamburgerMenu) {
                if (state.menuOpen) {
                    menu.classList.add('open');
                    hamburgerMenu.classList.add('open');
                } else {
                    menu.classList.remove('open');
                    hamburgerMenu.classList.remove('open');
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
            console.warn("[loadSetlistState] Shared setlist state not found or invalid. Initializing default date.");
            initializeDefaultDate(); // 共有が見つからない場合はデフォルト日付
            resolve();
          }
        })
        .catch((error) => {
          console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
          showMessageBox('セットリストのロードに失敗しました。');
          initializeDefaultDate(); // ロードエラー時もデフォルト日付
          reject(error);
        });
    } else {
      console.log("[loadSetlistState] No shareId found in URL. Initializing default date.");
      initializeDefaultDate();
      resolve();
    }
  });
}

/**
 * 日付ドロップダウンを今日の日付で初期化するヘルパー関数
 */
function initializeDefaultDate() {
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    if (setlistYear && setlistMonth && setlistDay) {
        const today = new Date();
        setlistYear.value = today.getFullYear();
        setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
        // 月を設定したら、日のオプションを更新
        updateDays(); // これが重要
        setlistDay.value = today.getDate().toString().padStart(2, '0');
        console.log(`[initializeDefaultDate] Initialized date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
    } else {
        console.warn("[initializeDefaultDate] Date select elements not found for default date initialization.");
    }
}


/*------------------------------------------------------------------------------------------------------------*/

document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing all components.");

    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    // 日のドロップダウンを更新する関数
    // この関数はDOMContentLoadedスコープ内でのみ使用
    const updateDays = () => {
        if (!setlistYear || !setlistMonth || !setlistDay) {
            console.warn("[updateDays] Date select elements not found. Cannot update days.");
            return;
        }
        setlistDay.innerHTML = ''; 
        const year = parseInt(setlistYear.value);
        const month = parseInt(setlistMonth.value);
        
        // 0を渡すと前月の最終日になるため、その月の日数を取得できる
        const daysInMonth = new Date(year, month, 0).getDate(); 

        for (let i = 1; i <= daysInMonth; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i;
            setlistDay.appendChild(option);
        }
        console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}`);
    };

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
    
    // 日付ドロップダウンが全て生成された後に、まずupdateDaysを呼び出して日を生成し、
    // その後でloadSetlistStateを呼び出すことで、デフォルトの日付が正しく設定されるようにする
    updateDays(); // 初回ロード時に日のオプションを正しく生成

    // 共有IDがあればセットリストをロード（またはデフォルト日付を設定）
    loadSetlistState().then(() => {
      console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
      hideSetlistItemsInMenu(); // ロード後にメニュー内のアイテムを隠す
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu();
    });
    
    // ハンバーガーメニューボタンのイベントリスナー
    // グローバル変数`hamburgerMenu`と`menu`はDOMContentLoaded時にすでに取得されている
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', toggleMenu);
        console.log("[DOMContentLoaded] Hamburger menu click listener added.");
    } else {
        console.warn("[DOMContentLoaded] Hamburger menu button element not found. Check ID 'hamburgerMenu' in HTML.");
    }
    if (!menu) {
        console.warn("[DOMContentLoaded] Menu element not found. Check ID 'menu' in HTML.");
    }


    // アルバムアイテムにドラッグ＆ドロップイベントを設定
    document.querySelectorAll(".album-content .item").forEach((item) => {
      enableDragAndDrop(item);
      console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId || 'N/A'}`);
    });

    // セットリストのスロットにドロップターゲットとしてのイベントを設定
    if (setlist) { // setlist要素が存在するか確認
        setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
          if (!slot.dataset.slotIndex) {
              slot.dataset.slotIndex = index.toString();
          }
          enableDragAndDrop(slot); // ドロップターゲットとしてのイベントを設定

          // 各スロットに初期の「+」ボタンを追加
          clearSlotContent(slot); // これで初期の+ボタンが追加される

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
          // セットリストスロットが中身を持つ場合、fillSlotWithItemでdragstart, touchstart, dblclickも設定される

        });
        console.log("[DOMContentLoaded] Enabled drag and drop for setlist slots.");
    } else {
        console.error("[DOMContentLoaded] Setlist element not found. Check ID 'setlist' in HTML.");
    }

    // アルバム開閉ボタンのイベントリスナー
    albumToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const albumContent = button.nextElementSibling; // 次の要素がアルバムコンテンツ
            if (albumContent && albumContent.classList.contains('album-content')) {
                albumContent.classList.toggle('active');
                button.classList.toggle('active'); // ボタン自身のクラスも切り替えてCSSでスタイルを適用
                console.log(`[DOMContentLoaded] Album ${albumContent.id} toggled. Active: ${albumContent.classList.contains('active')}`);
            }
        });
    });
    console.log("[DOMContentLoaded] Album toggle listeners added.");

    // 「セットリストをクリア」ボタンのイベントリスナー
    if (clearSetlistButton) {
        clearSetlistButton.addEventListener('click', clearSetlist);
        console.log("[DOMContentLoaded] Clear setlist button listener added.");
    } else {
        console.warn("[DOMContentLoaded] Clear setlist button not found.");
    }

    // 「共有URLを生成」ボタンのイベントリスナー
    if (shareSetlistButton) {
        shareSetlistButton.addEventListener('click', shareSetlist);
        console.log("[DOMContentLoaded] Share setlist button listener added.");
    } else {
        console.warn("[DOMContentLoaded] Share setlist button not found.");
    }

    // 「PDFを生成」ボタンのイベントリスナー
    if (generatePdfButton) {
        generatePdfButton.addEventListener('click', generateSetlistPdf);
        console.log("[DOMContentLoaded] Generate PDF button listener added.");
    } else {
        console.warn("[DOMContentLoaded] Generate PDF button not found.");
    }
    
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
            // グローバル変数がnullの場合に備えて再取得またはnullチェックを強化
            const currentMenu = document.getElementById("menu"); 
            if (currentMenu && currentMenu.classList.contains('open')) {
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