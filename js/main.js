// =============================================================================
// グローバル変数とDOM要素の参照
// =============================================================================

// --- グローバル変数定義 ---

// PCドラッグ＆ドロップ関連
let currentPcDraggedElement = null;     // PCドラッグ中に参照する元の要素（主にアルバムからドラッグする際のクローン）
let originalParent = null;              // PCドラッグ：ドラッグ元の親要素を保持 (drop処理用)
let originalNextSibling = null;         // PCドラッグ：ドラッグ元の次の兄弟要素を保持 (drop処理用)
let currentDropZone = null;             // PC/Mobile共通：現在のドロップゾーン要素（ハイライト用）

// タッチドラッグ＆ドロップ関連
let currentTouchDraggedClone = null;    // タッチドラッグ中に動かす**クローン要素**
let currentTouchDraggedOriginalElement = null; // タッチドラッグ：ドラッグ元の**オリジナル要素**（隠す対象）
let touchStartX = 0;                    // タッチ開始時のX座標
let touchStartY = 0;                    // タッチ開始時のY座標
let touchTimeout = null;                // ロングプレスを判定するためのsetTimeoutのID
let isDragging = false;                 // 現在ドラッグ中かどうかのフラグ (タッチドラッグ用)
// let activeTouchSlot = null;          // currentDropZoneに統一することを推奨
let rafId = null;                       // requestAnimationFrame のID (スムーズなアニメーション用、現在未使用)

// 共通変数
let draggingItemId = null;              // ドラッグ中のアイテムID (PC/Mobile共通)
let originalSetlistSlot = null;         // PC/Mobile共通：セットリスト内でドラッグ開始された「元のスロット要素」を指す（placeholder処理用）
const originalAlbumMap = new Map();     // 各アイテムの元のアルバムIDを保持するMap（現在未使用だが、アルバム間移動などで役立つ可能性）

// DOM要素の取得
const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list");

// 定数
const maxSongs = 26; // セットリストの最大曲数

// アルバム1として扱うdata-item-idのリスト（共有テキスト、PDF生成時に使用）
const album1ItemIds = [
    'album1-001', 'album1-002', 'album1-004', 'album1-003', 'album1-005',
    'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-010',
    'album1-011', 'album1-012', 'album1-013'
];

let lastTapTime = 0; // ダブルタップ判定に使用


// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * スロット内のアイテムからデータを抽出し、オブジェクトとして返す。
 * @param {Element} element - データ抽出元の要素 (setlist-item, album .item, or clone)
 * @returns {object|null} 曲のデータオブジェクト、またはnull
 */
function getSlotItemData(element) {
    if (!element) {
        console.warn("[getSlotItemData] Provided element is null. Returning null.");
        return null;
    }

    const isSetlistItem = element.classList.contains('setlist-item');
    const isAlbumItem = element.classList.contains('item') && !isSetlistItem; // album item は setlist-item でない
    const isClone = element.classList.contains('dragging-clone'); // クローン要素を識別するためのクラスを想定

    let songName = '';
    let isCheckedShort = false;
    let isCheckedSe = false;
    let isCheckedDrumsolo = false;
    let hasShortOption = false;
    let hasSeOption = false;
    let hasDrumsoloOption = false;

    // albumClass は element.classList から取得
    // albumX の形式のクラスを取得
    const albumClass = Array.from(element.classList).find(className => className.startsWith('album') && className !== 'album-content');
    let itemId = element.dataset.itemId;

    // dataset から取得する際は、デフォルト値を設定
    let rGt = element.dataset.rGt || '';
    let lGt = element.dataset.lGt || '';
    let bass = element.dataset.bass || '';
    let bpm = element.dataset.bpm || '';
    let chorus = element.dataset.chorus || ''; // コーラスは単なる表示フラグなので文字列のままで良い

    if (isSetlistItem) {
        // セットリストアイテムの場合、datasetから曲名を取得し、チェックボックスの状態を直接見る
        songName = element.dataset.songName || '';
        isCheckedShort = element.dataset.short === 'true'; // datasetから直接取得
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';

        // 元々そのオプションがあったかどうかはdatasetから
        hasShortOption = element.dataset.hasShortOption === 'true';
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

    } else if (isAlbumItem) {
        // アルバムアイテムの場合、datasetから直接取得
        songName = element.dataset.songName || element.textContent.trim();
        hasShortOption = element.dataset.isShortVersion === 'true'; // HTMLのdata-is-short-versionから取得
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.drumsoloOption === 'true';

        // アルバムアイテムでは、これらのオプションは「設定可能かどうか」であり、
        // チェックされた状態はセットリストに移動した際に初めて持つものなので、ここではfalse
        isCheckedShort = false;
        isCheckedSe = false;
        isCheckedDrumsolo = false;

    } else if (isClone) { // クローン要素の場合 (datasetから取得)
        songName = element.dataset.songName || '';
        isCheckedShort = element.dataset.short === 'true'; // クローンでは dataset.short が現在の状態を示す
        isCheckedSe = element.dataset.seChecked === 'true';
        isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';

        hasShortOption = element.dataset.hasShortOption === 'true'; // クローンは元の要素のデータ属性を継承
        hasSeOption = element.dataset.hasSeOption === 'true';
        hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';
    } else {
        console.warn("[getSlotItemData] Element has no recognizable data for item:", element);
        return null;
    }

    return {
        name: songName,
        short: isCheckedShort, // 現在チェックされているか
        seChecked: isCheckedSe, // 現在チェックされているか
        drumsoloChecked: isCheckedDrumsolo, // 現在チェックされているか
        hasShortOption: hasShortOption, // このオプションが元々存在するか（表示するかどうか）
        hasSeOption: hasSeOption, // このオプションが元々存在するか
        hasDrumsoloOption: hasDrumsoloOption, // このオプションが元々存在するか
        albumClass: albumClass,
        itemId: itemId,
        slotIndex: element.dataset.slotIndex, // セットリストアイテムの場合のみ有効
        rGt: rGt,
        lGt: lGt,
        bass: bass,
        bpm: bpm,
        chorus: chorus
    };
}

/**
 * 指定されたセットリストのスロットからアイテムをクリアする。
 * @param {HTMLElement} slotElement - クリアするセットリストのスロット要素。
 */
function clearSlotContent(slotElement) {
    // スロットが実際にコンテンツを持っているかを確認
    if (!slotElement || !slotElement.classList.contains('setlist-item')) {
        console.warn("[clearSlotContent] Provided element is not a setlist item or is null. No action taken.");
        return; // 無効な要素または空のスロットであれば何もしないで終了
    }

    const slotIndex = slotElement.dataset.slotIndex;
    const itemId = slotElement.dataset.itemId; // 削除するアイテムIDをログに残すため

    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }

    // アイテムを示すクラスとデータ属性を全て削除
    // スロットのスタイルやクラスをリセット
    slotElement.classList.remove(
        'setlist-item', 'item', 'album1', 'album2', 'album3', 'album4', 'album5',
        'album6', 'album7', 'album8', 'album9', 'album10', 'album11', 'album12',
        'album13', 'album14', 'short', 'se-active', 'drumsolo-active'
    );

    // dataset をクリア（slotIndexは残す）
    const originalSlotIndex = slotElement.dataset.slotIndex;
    for (const key in slotElement.dataset) {
        delete slotElement.dataset[key];
    }
    slotElement.dataset.slotIndex = originalSlotIndex; // slotIndexだけは残す

    // スロットが空になったらpointer-eventsをnoneにする（ドラッグ＆ドロップのターゲットにしないため）
    slotElement.style.pointerEvents = 'none';
    slotElement.style.touchAction = 'none'; // タッチアクションも無効にする

    console.log(`[clearSlotContent] Slot ${slotIndex} (item: ${itemId}) cleared successfully.`);
}


/**
 * セットリストから曲を削除し、アルバムリストに「戻す」処理 (実際にはセットリストから削除するだけ)。
 * @param {HTMLElement} setlistItem - セットリストから削除するHTML要素。
 */
function restoreToOriginalList(setlistItem) {
    if (!setlistItem || !setlistItem.classList.contains('setlist-item')) {
        console.warn("[restoreToOriginalList] Invalid element passed or element is not a setlist item. Cannot restore.");
        return; // 無効な要素であれば処理を中断
    }

    const slotIndex = setlistItem.dataset.slotIndex;
    const itemId = setlistItem.dataset.itemId;

    console.log(`[restoreToOriginalList] Restoring item ${itemId} from slot ${slotIndex} to original list.`);

    // スロットの内容をクリア
    clearSlotContent(setlistItem);

    // アルバムメニュー内の表示を更新 (hideSetlistItemsInMenuが呼ばれることで、このアイテムが再表示される)
    hideSetlistItemsInMenu();

    // セットリストの状態を保存
    saveSetlistState();

    showMessage("セットリストから曲を削除しました。", "success");
}


/**
 * カスタムメッセージボックスを表示する関数 (alertの代替)。
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージの種類 ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
    let messageBox = document.getElementById('customMessageBox');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'customMessageBox';
        document.body.appendChild(messageBox);
    }
    // スタイルをリセットし、新しいタイプを適用
    messageBox.className = ''; // 既存のクラスをクリア
    messageBox.classList.add(type); // 新しいタイプクラスを追加

    messageBox.textContent = message;
    messageBox.style.opacity = '0';
    messageBox.style.display = 'block';

    setTimeout(() => messageBox.style.opacity = '1', 10);
    setTimeout(() => {
        messageBox.style.opacity = '0';
        messageBox.addEventListener('transitionend', function handler() {
            messageBox.style.display = 'none';
            messageBox.removeEventListener('transitionend', handler);
        }, { once: true });
    }, 2000);
    console.log(`[showMessageBox] Displaying message: "${message}" (Type: ${type})`);
}


/**
 * セットリストにある曲をアルバムメニュー内で非表示にする。
 */
function hideSetlistItemsInMenu() {
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");
    // まずすべてのアルバムアイテムを可視状態に戻す
    document.querySelectorAll('.album-content .item').forEach(item => {
        item.style.visibility = ''; // CSSのデフォルトに戻す (display: none; ではない)
        item.style.pointerEvents = 'auto'; // 再表示されたらイベントを受け付ける
    });

    const currentSetlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
    if (currentSetlistItems.length === 0) {
        console.log("[hideSetlistItemsInMenu] Setlist is empty, all album items should be visible.");
        return;
    }

    const setlistItemIds = new Set();
    currentSetlistItems.forEach(slot => {
        const itemId = slot.dataset.itemId;
        if (itemId) {
            setlistItemIds.add(itemId);
        }
    });

    albumList.querySelectorAll('.item').forEach(albumItem => { // albumListから探索
        if (albumItem.dataset.itemId && setlistItemIds.has(albumItem.dataset.itemId)) {
            albumItem.style.visibility = 'hidden'; // 非表示にする
            albumItem.style.pointerEvents = 'none'; // 非表示のアイテムはクリック・ドラッグできないようにする
            console.log(`[hideSetlistItemsInMenu] HIDDEN: Album item in menu: ${albumItem.dataset.itemId}`);
        }
    });
    console.log("[hideSetlistItemsInMenu] END: Finished updating album menu item visibility.");
}


/**
 * セットリストの内容を取得する。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
    const currentSetlist = Array.from(document.querySelectorAll("#setlist .setlist-slot.setlist-item"))
        .map((slot, index) => {
            const songData = getSlotItemData(slot);
            if (!songData) return ''; // データが取得できない場合は空文字列を返す

            let line = `${index + 1}. ${songData.name || ''}`;
            if (songData.short) line += ' (Short)';
            if (songData.seChecked) line += ' (SE有り)';
            if (songData.drumsoloChecked) line += ' (ドラムソロ有り)';

            const tunings = [];
            // R.Gt, L.Gt, Bass は文字列なので、値があれば追加
            if (songData.rGt) tunings.push(`R.Gt:${songData.rGt}`);
            if (songData.lGt) tunings.push(`L.Gt:${songData.lGt}`);
            if (songData.bass) tunings.push(`Bass:${songData.bass}`);
            if (tunings.length > 0) line += ` (${tunings.join(' ')})`;

            if (songData.bpm) line += ` (BPM:${songData.bpm})`;
            // chorus は `true`/`false` 文字列で保存されるため、'true'の場合のみ表示
            if (songData.chorus === 'true') line += ` (C:${songData.chorus})`;
            return line;
        });
    console.log("[getSetlist] Current setlist:", currentSetlist);
    return currentSetlist;
}

/**
 * 現在のアプリケーションの状態（セットリスト、メニューの開閉、開いているアルバム、日付、会場）を取得する。
 * @returns {object} 現在の状態オブジェクト
 */
function getCurrentState() {
    const setlistState = Array.from(setlist.children)
        .map(slot => slot.classList.contains('setlist-item') ? getSlotItemData(slot) : null)
        .filter(item => item !== null);

    const menuOpen = menu.classList.contains('open');
    const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

    const originalAlbumMapAsObject = {};
    originalAlbumMap.forEach((value, key) => originalAlbumMapAsObject[key] = value);

    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    let selectedDate = '';
    if (setlistYear && setlistMonth && setlistDay) {
        // 年、月、日が存在することを確認し、日付フォーマットを 'YYYY/MM/DD' に統一
        const year = setlistYear.value;
        const month = setlistMonth.value;
        const day = setlistDay.value;
        if (year && month && day) {
            selectedDate = `${year}/${month}/${day}`;
        }
    } else {
        console.warn("[getCurrentState] Date select elements not found. Date will be empty for saving.");
    }
    const setlistVenue = document.getElementById('setlistVenue')?.value || '';

    console.log("[getCurrentState] State for saving:", { setlist: setlistState, menuOpen, openAlbums, originalAlbumMap: originalAlbumMapAsObject, setlistDate: selectedDate, setlistVenue });
    return {
        setlist: setlistState,
        menuOpen: menuOpen,
        openAlbums: openAlbums,
        originalAlbumMap: originalAlbumMapAsObject,
        setlistDate: selectedDate,
        setlistVenue: setlistVenue
    };
}


/**
 * スロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 */
function fillSlotWithItem(slotElement, songData) {
    console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
    console.log(`[fillSlotWithItem] songData received:`, songData);

    // addSongToSlot を呼び出して、すべての設定とイベントリスナーを一度に行う
    // songData.short, songData.seChecked, songData.drumsoloChecked は addSongToSlot の options で使用される
    addSongToSlot(slotElement, songData.itemId, songData.name, {
        // `has`プロパティは、そのオプションが「設定可能」かどうか
        isShortVersion: songData.hasShortOption,
        hasSeOption: songData.hasSeOption,
        drumsoloOption: songData.hasDrumsoloOption,
        rGt: songData.rGt,
        lGt: songData.lGt,
        bass: songData.bass,
        bpm: songData.bpm,
        chorus: songData.chorus,
        // そして、実際にチェックされているかどうかの状態も渡す
        short: songData.short,
        seChecked: songData.seChecked,
        drumsoloChecked: songData.drumsoloChecked
    }, songData.albumClass); // albumClass も渡す
}


// =============================================================================
// ドラッグ&ドロップ、タッチイベントハンドラ
// =============================================================================

/**
 * ドラッグ開始時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragStart(event) {
    const originalElement = event.target.closest(".item") || event.target.closest(".setlist-item");
    if (!originalElement) {
        console.warn("[handleDragStart:PC] No draggable item found. Aborting drag.");
        event.preventDefault(); // ドラッグをキャンセル
        return;
    }

    draggingItemId = originalElement.dataset.itemId;
    if (!draggingItemId) {
        console.warn("[handleDragStart:PC] Draggable item has no itemId. Aborting drag.");
        event.preventDefault();
        return;
    }
    event.dataTransfer.setData("text/plain", draggingItemId);
    event.dataTransfer.effectAllowed = "move";

    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        originalSetlistSlot.style.visibility = 'hidden';
        originalSetlistSlot.classList.add('placeholder-slot');
        currentPcDraggedElement = originalElement; // 元のスロット要素を保持
        console.log(`[handleDragStart:PC] Dragging from setlist slot (originalSetlistSlot): ${originalSetlistSlot.dataset.slotIndex}, hidden and placeholder added.`);
    } else {
        originalSetlistSlot = null; // アルバムからのドラッグ
        currentPcDraggedElement = originalElement; // アルバムアイテム自体を参照 (直接ドラッグされるのはクローンではない)
        console.log(`[handleDragStart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the currentPcDraggedElement.`);
    }

    // 元のアルバムリスト情報を記録（既に存在する場合は更新しない）
    if (!originalAlbumMap.has(draggingItemId)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null; // album-list divのIDなど
        originalAlbumMap.set(draggingItemId, originalListId);
        console.log(`[handleDragStart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
    } else {
        console.log(`[handleDragStart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
    }
    currentPcDraggedElement.classList.add("dragging"); // PCドラッグ中の要素にクラスを追加 (視覚的なフィードバック用)
    console.log(`[handleDragStart] dataTransfer set with: ${draggingItemId}`);
}

/**
 * ドラッグ要素がドロップターゲットに入った時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragEnter(event) {
    event.preventDefault(); // ドロップを許可するために必要
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        // 同じスロットへのドラッグバックの場合、ハイライトしない
        const isSelfSlot = originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;
        if (!isSelfSlot) {
            targetSlot.classList.add('drag-over');
            // currentDropZoneを更新
            currentDropZone = targetSlot;
            console.log(`[handleDragEnter] Entered slot: ${targetSlot.dataset.slotIndex}`);
        }
    }
}

/**
 * ドラッグ退出時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
    const targetSlot = event.target.closest('.setlist-slot');
    if (targetSlot) {
        // `event.relatedTarget` を確認し、子要素への移動でなければ drag-over を削除
        // これにより、スロットの子要素（例: 曲名、チェックボックス）の上にマウスが移動しても
        // drag-overが解除されないようにする。
        if (!event.relatedTarget || !targetSlot.contains(event.relatedTarget)) {
            targetSlot.classList.remove('drag-over');
            if (currentDropZone === targetSlot) {
                currentDropZone = null;
            }
            console.log(`[handleDragLeave] Left slot: ${targetSlot.dataset.slotIndex}`);
        }
    }
}

/**
 * ドラッグオーバー時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault(); // ドロップを許可するために必要
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'; // ドロップカーソルを表示
    }

    // draggingItemId が設定されていない場合は何もしない（不正なドラッグイベント）
    if (!draggingItemId) {
        console.warn("[handleDragOver] draggingItemId is null. Aborting dragover.");
        return;
    }

    const targetSlot = event.target.closest('.setlist-slot');
    const newDropZone = targetSlot;

    // 現在ハイライトされているスロットがあれば解除
    if (currentDropZone && currentDropZone !== newDropZone) {
        currentDropZone.classList.remove('drag-over');
    }

    if (newDropZone) {
        // 同じスロットへのドラッグバックの場合、ハイライトしない
        const isSelfSlot = originalSetlistSlot && newDropZone.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;

        if (!isSelfSlot) { // 自分自身のスロットにはハイライトしない
            newDropZone.classList.add('drag-over');
            currentDropZone = newDropZone;
        } else {
            // 自分自身の上にドラッグオーバーしている場合はハイライトを解除
            if (currentDropZone === newDropZone) {
                currentDropZone.classList.remove('drag-over');
                currentDropZone = null;
            }
        }
    } else {
        // スロット以外の場所にいる場合、ハイライトを解除
        if (currentDropZone) {
            currentDropZone.classList.remove('drag-over');
            currentDropZone = null;
        }
    }
}

/**
 * ドロップ処理を実行する関数。
 * PCとタッチドラッグ両方から呼び出される共通ロジック。
 * @param {HTMLElement} draggedElement - ドロップされた要素（元のアルバムアイテム、またはセットリストからの移動元のスロット、またはタッチドラッグのクローン）
 * @param {HTMLElement} dropTargetSlot - ドロップされた先のセットリストスロット。
 * @param {HTMLElement | null} originalSourceSlot - 元のセットリストスロット（セットリスト内からのドラッグの場合）。
 */
function processDrop(draggedElement, dropTargetSlot, originalSourceSlot) {
    console.log("[processDrop] Initiated.");
    console.log("Dragged Element:", draggedElement);
    console.log("Drop Target Slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "N/A");
    console.log("Original Source Slot:", originalSourceSlot ? originalSourceSlot.dataset.slotIndex : "N/A");

    // 無効なドロップターゲットは無視
    if (!dropTargetSlot || !dropTargetSlot.classList.contains('setlist-slot')) {
        console.warn("[processDrop] Invalid drop target (not a setlist-slot). Aborting.");
        showMessage("有効なドロップ位置ではありません。", "error");
        return;
    }

    // ドロップされたアイテムのデータを取得
    // ここで `getSlotItemData` を使用して、元の要素またはクローンからデータを確実に取得
    const songData = getSlotItemData(draggedElement);
    if (!songData || !songData.itemId) {
        console.error("[processDrop] Failed to get song data from dragged element. Aborting.");
        showMessage("曲データの取得に失敗しました。", "error");
        return;
    }

    // 元のスロットとドロップ先が同じ場合（セットリスト内での自己ドロップ）
    if (originalSourceSlot && dropTargetSlot.dataset.slotIndex === originalSourceSlot.dataset.slotIndex) {
        console.log("[processDrop] Dropped back into the same slot. No change needed.");
        showMessage("同じ位置にドロップしました。", "info");
        return;
    }

    // 元のスロットが存在する場合（セットリスト内からの移動）
    if (originalSourceSlot) {
        console.log("[processDrop] Moving item within setlist.");
        // ドロップ先スロットに既にアイテムがあるか確認
        if (dropTargetSlot.classList.contains('setlist-item')) {
            // 入れ替え処理
            console.log(`[processDrop] Swapping item from slot ${originalSourceSlot.dataset.slotIndex} with item in slot ${dropTargetSlot.dataset.slotIndex}.`);

            // ドロップ先アイテムのデータを取得
            const targetSongData = getSlotItemData(dropTargetSlot);
            if (!targetSongData) {
                console.error("[processDrop] Failed to get data for target slot during swap. Aborting.");
                showMessage("曲の入れ替えに失敗しました。", "error");
                return;
            }

            // 元のスロットにドロップ先アイテムを再配置
            clearSlotContent(originalSourceSlot);
            addSongToSlot(originalSourceSlot, targetSongData.itemId, targetSongData.name, {
                isShortVersion: targetSongData.hasShortOption,
                hasSeOption: targetSongData.hasSeOption,
                drumsoloOption: targetSongData.hasDrumsoloOption,
                rGt: targetSongData.rGt,
                lGt: targetSongData.lGt,
                bass: targetSongData.bass,
                bpm: targetSongData.bpm,
                chorus: targetSongData.chorus,
                short: targetSongData.short,
                seChecked: targetSongData.seChecked,
                drumsoloChecked: targetSongData.drumsoloChecked
            }, targetSongData.albumClass);

            // ドロップ先にドラッグされたアイテムを配置
            clearSlotContent(dropTargetSlot);
            // songData は `getSlotItemData` から取得したデータなので、そのまま渡せる
            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                short: songData.short,
                seChecked: songData.seChecked,
                drumsoloChecked: songData.drumsoloChecked
            }, songData.albumClass);

            showMessage("セットリスト内の曲を移動しました。", "success");

        } else {
            // 空のスロットへの移動
            console.log(`[processDrop] Moving item from slot ${originalSourceSlot.dataset.slotIndex} to empty slot ${dropTargetSlot.dataset.slotIndex}.`);
            clearSlotContent(originalSourceSlot);
            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                short: songData.short,
                seChecked: songData.seChecked,
                drumsoloChecked: songData.drumsoloChecked
            }, songData.albumClass);
            showMessage("セットリスト内の曲を移動しました。", "success");
        }
    } else {
        // 元のスロットが存在しない場合（アルバムからの追加）
        console.log("[processDrop] Adding item from album to setlist.");
        if (dropTargetSlot.classList.contains('setlist-item')) {
            // 埋まっているスロットへのアルバムからのドロップは許可しない
            showMessage("既に曲があるスロットには追加できません。", "error");
            console.warn("[processDrop] Cannot drop album item into an occupied setlist slot.");
            return;
        } else {
            // 空のスロットへのアルバムからのドロップ
            addSongToSlot(dropTargetSlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                short: songData.short,
                seChecked: songData.seChecked,
                drumsoloChecked: songData.drumsoloChecked
            }, songData.albumClass);
            showMessage("セットリストに曲を追加しました。", "success");
        }
    }
    // ドロップが成功したら、セットリストの状態を保存
    saveSetlistState();
    // メニュー内の表示を更新
    hideSetlistItemsInMenu();
}

/**
 * ドロップ時の処理 (PC向け)。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
    event.preventDefault();
    console.log("[handleDrop] Drop event fired (PC).");
    const droppedItemId = event.dataTransfer.getData("text/plain");
    console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

    let draggedElement; // processDropに渡す要素を定義
    // セットリストからのドラッグの場合、originalSetlistSlotが直接ドラッグされたアイテムになる
    if (originalSetlistSlot && originalSetlistSlot.dataset.itemId === droppedItemId) {
        draggedElement = originalSetlistSlot;
    } else {
        // アルバムからのドラッグの場合、元のアルバムアイテムを探す
        draggedElement = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
    }

    if (!draggedElement) {
        console.error("[handleDrop] draggedElement not found in DOM with itemId:", droppedItemId, ". Aborting drop and finishing dragging.");
        finishDragging(); // 不正な状態なのでクリーンアップ
        return;
    }
    console.log("[handleDrop] draggedElement found:", draggedElement);

    const dropTargetSlot = event.target.closest('.setlist-slot');
    console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

    // 実際のドロップ処理を共通関数に委譲
    processDrop(draggedElement, dropTargetSlot, originalSetlistSlot);

    finishDragging(); // ドロップ処理後に必ずクリーンアップ
}

/**
 * ドラッグ終了時の共通クリーンアップ処理 (PC/Mobile共通)。
 */
function finishDragging() {
    console.log("[finishDragging] Cleaning up drag state.");

    // PCドラッグの要素をリセット
    if (currentPcDraggedElement) {
        currentPcDraggedElement.classList.remove("dragging");
        // セットリストからのドラッグだった場合、非表示にした元の要素を再表示し、placeholderクラスを削除
        if (originalSetlistSlot) {
            originalSetlistSlot.style.visibility = ''; // CSSのデフォルトに戻す
            originalSetlistSlot.classList.remove('placeholder-slot');
        } else {
            // アルバムからのドラッグの場合、元々隠していなかったので再表示の必要はない
            // hideSetlistItemsInMenuで適切に管理される
        }
        currentPcDraggedElement = null;
    }

    // タッチドラッグの要素をリセット
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove(); // クローンをDOMから削除
        currentTouchDraggedClone = null;
    }
    if (currentTouchDraggedOriginalElement) {
        // アルバムのアイテムを非表示にしていた場合も、ここで再表示
        // セットリストのアイテムはoriginalSetlistSlotで処理されるため、重複を避ける
        if (!originalSetlistSlot) { // originalSetlistSlotがnull（アルバムからのドラッグ）の場合
            currentTouchDraggedOriginalElement.style.visibility = ''; // CSSのデフォルトに戻す
        }
        currentTouchDraggedOriginalElement = null;
    }

    // すべてのスロットから drag-over クラスを削除
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
    });

    // スロットのpointer-eventsとtouch-actionをリセット
    // ここで一括でリセットする。各ハンドラ内で一時的にautoにしても、ここで最終的に制御
    document.querySelectorAll('.setlist-slot').forEach(slot => {
        if (slot.classList.contains('setlist-item')) {
            slot.style.pointerEvents = 'auto'; // 曲が入っているスロットはイベント有効
            slot.style.touchAction = 'pan-y'; // タッチスクロール可能
        } else {
            slot.style.pointerEvents = 'none'; // 空スロットはイベント無効
            slot.style.touchAction = 'none'; // タッチアクション無効
        }
    });

    // グローバルドラッグ状態をリセット
    isDragging = false;
    draggingItemId = null;
    originalSetlistSlot = null; // セットリストからのドラッグ元スロットをリセット
    currentDropZone = null;
    clearTimeout(touchTimeout);
    touchTimeout = null;
    lastTapTime = 0; // ダブルタップ検出用の時間もリセット

    console.log("[finishDragging] Cleanup complete.");
}


/**
 * タッチ開始時の処理 (モバイル向け)。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchStart(event) {
    // 複数の指でタッチされた場合は無視（ピンチズームなどとの競合回避）
    if (event.touches.length > 1) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        isDragging = false;
        console.log("[handleTouchStart:Mobile] Multiple touches detected. Aborting potential drag.");
        return;
    }

    const touchedElement = event.target.closest(".setlist-slot.setlist-item") || event.target.closest(".item");

    // チェックボックスが直接タッチされた場合、ドラッグを開始しない
    const closestCheckbox = event.target.closest('input[type="checkbox"]');
    if (closestCheckbox) {
        console.log("[handleTouchStart:Mobile] Checkbox clicked directly. Allowing native behavior and preventing drag.");
        clearTimeout(touchTimeout);
        touchTimeout = null;
        isDragging = false;
        event.stopPropagation(); // 親要素へのイベント伝播を停止
        return;
    }

    if (!touchedElement) {
        console.log("[handleTouchStart:Mobile] Touched an element that is not a draggable item (e.g., empty slot or background). Allowing default behavior.");
        clearTimeout(touchTimeout); // 念のためタイムアウトをクリア
        touchTimeout = null;
        isDragging = false;
        return;
    }

    // ドラッグ開始の可能性がある場合のみ、デフォルトのスクロールなどを防ぐ
    // ただし、ダブルタップ判定やロングプレス待機中はpreventDafaultでスクロールを止める。
    event.preventDefault();

    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    // ダブルタップ判定（300ms以内）
    if (tapLength < 300 && tapLength > 0 && !isDragging) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        // ダブルタップされた要素の特定
        const targetForDoubleClick = event.target.closest(".setlist-slot.setlist-item");
        if (targetForDoubleClick) {
            handleDoubleClick(targetForDoubleClick); // ダブルタップハンドラを呼び出し
            console.log("[handleTouchStart:Mobile] Double tap detected. Handled by handleDoubleClick.");
        } else {
            console.log("[handleTouchStart:Mobile] Double tap detected on non-setlist item. Ignoring.");
        }
        lastTapTime = 0; // ダブルタップ後はリセット
        return;
    }
    lastTapTime = currentTime; // 次のタップのために時間を記録

    // ロングプレス判定のための初期設定
    clearTimeout(touchTimeout); // 既存のタイムアウトをクリア
    isDragging = false; // ドラッグ開始前はfalseにリセット
    draggingItemId = touchedElement.dataset.itemId;

    if (setlist.contains(touchedElement) && touchedElement.classList.contains('setlist-item')) {
        originalSetlistSlot = touchedElement;
        currentTouchDraggedOriginalElement = touchedElement; // セットリスト内の元の要素
        console.log(`[handleTouchStart:Mobile] Potential drag from setlist slot: ${originalSetlistSlot.dataset.slotIndex}`);
    } else {
        originalSetlistSlot = null; // アルバムからのドラッグ
        currentTouchDraggedOriginalElement = touchedElement; // アルバム内の元の要素
        console.log(`[handleTouchStart:Mobile] Potential drag from album: ${touchedElement.dataset.itemId}`);
    }

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;

    touchTimeout = setTimeout(() => {
        // ロングプレスが確定し、ドラッグを開始
        if (draggingItemId && document.body.contains(currentTouchDraggedOriginalElement)) {
            isDragging = true; // ドラッグ状態をtrueに設定

            // 元の要素を非表示
            currentTouchDraggedOriginalElement.style.visibility = 'hidden';
            if (originalSetlistSlot) { // セットリストからのドラッグの場合、プレースホルダーも追加
                originalSetlistSlot.classList.add('placeholder-slot');
                console.log(`[handleTouchStart:Mobile] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} hidden and marked as placeholder.`);
            } else {
                console.log(`[handleTouchStart:Mobile] Original album item ${currentTouchDraggedOriginalElement.dataset.itemId} hidden.`);
            }

            // クローンを作成し、表示
            createTouchDraggedClone(currentTouchDraggedOriginalElement, touchStartX, touchStartY, draggingItemId);
            console.log("[handleTouchStart:Mobile] Dragging initiated after timeout. Clone created and original hidden.");

            // ドラッグ開始時にすべてのセットリストスロットをドロップ可能にする（highlightなども含め）
            document.querySelectorAll('.setlist-slot').forEach(slot => {
                slot.style.pointerEvents = 'auto'; // ドロップターゲットとして有効
                slot.style.touchAction = 'pan-y'; // スロット内のスクロールを許可
            });
        } else {
            console.warn("[handleTouchStart:Mobile] Dragging not initiated after timeout (element removed or ID missing).");
            isDragging = false; // ドラッグが開始されなかった場合はフラグをリセット
        }
        touchTimeout = null;
    }, 600); // 600ms のロングプレスでドラッグ開始
}


/**
 * タッチ移動時の処理 (モバイル向け)。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchMove(event) {
    if (!isDragging || !currentTouchDraggedClone) {
        return; // ドラッグ中でなければ何もしない
    }

    event.preventDefault(); // デフォルトのスクロール動作などを防止

    const touch = event.touches[0];
    if (!touch) {
        console.warn("[handleTouchMove] No touch object found in event. Aborting move.");
        return;
    }

    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // クローン要素の位置を更新
    // クローンの中心がタッチ位置になるように調整
    const cloneRect = currentTouchDraggedClone.getBoundingClientRect();
    currentTouchDraggedClone.style.left = `${currentX - cloneRect.width / 2}px`;
    currentTouchDraggedClone.style.top = `${currentY - cloneRect.height / 2}px`;

    // ドラッグオーバーのハイライトをリセット
    if (currentDropZone) {
        currentDropZone.classList.remove('drag-over');
        currentDropZone = null;
    }

    // 現在のタッチ位置にある要素を取得
    const elementsAtPoint = document.elementsFromPoint(currentX, currentY);

    // ドロップ可能なセットリストスロットを探す
    const targetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    if (targetSlot) {
        // ターゲットスロットが自身の元のスロットでない、かつ有効なドロップターゲットである場合
        const isSelfSlot = originalSetlistSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex;

        if (!isSelfSlot) { // 自分自身のスロットにはハイライトしない
            targetSlot.classList.add('drag-over');
            currentDropZone = targetSlot; // currentDropZoneを更新
        }
    }
}


/**
 * タッチ終了時の処理 (モバイル向け)。
 * @param {TouchEvent} event - タッチイベント
 */
function handleTouchEnd(event) {
    // タイムアウトがある場合はクリアし、ロングプレスの判定をキャンセル
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
        console.warn("[handleTouchEnd] No touch object found in event. Aborting.");
        finishDragging(true); // 不完全な状態なのでキャンセル扱いとしてクリーンアップ
        return;
    }

    const currentX = touch.clientX;
    const currentY = touch.clientY;

    // isDragging フラグが立っていない、つまりドラッグが開始されなかった単なるタップの場合
    // または、チェックボックスがタッチされた場合は、何もしない（ネイティブ動作に任せる）
    if (!isDragging) {
        // ここに到達するということは、handleTouchStartでisDragging=trueにならなかったケース
        // 例: 短いタップ、チェックボックスへのタップなど
        console.log("[handleTouchEnd] Dragging was not initiated or it was a short tap/checkbox tap. No drag-specific action taken.");
        // イベントのデフォルト動作（例: クリック）を許可するため、preventDefaultはここでは呼ばない
        return;
    }

    // ここに到達した場合は、isDragging = true であり、かつロングプレスが確定してドラッグが始まった状態
    event.preventDefault(); // ドラッグ後のスクロールなど、ブラウザのデフォルト動作を防止

    const deltaX = Math.abs(currentX - touchStartX);
    const deltaY = Math.abs(currentY - touchStartY);
    const dragThreshold = 10; // ドラッグとみなす最小移動距離（ピクセル単位）

    // ドラッグは開始されたが、指の移動が最小限だった場合（ロングプレス後、ほぼ移動せず指を離したケース）
    // この場合も、ドロップとは見なさず、キャンセルとしてクリーンアップする
    if (deltaX < dragThreshold && deltaY < dragThreshold) {
        console.log("[handleTouchEnd] Drag initiated but finger moved minimally (delta < threshold). Treating as cancelled drag.");
        showMessage("ドラッグがキャンセルされました。", "info"); // ユーザーへのフィードバック
        finishDragging(true); // キャンセルされたドラッグとしてクリーンアップ
        return;
    }

    // 指が離された位置にある要素を取得
    // `document.elementsFromPoint` は現在のカーソル位置にある要素の配列を返す
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const dropTargetSlot = elementsAtPoint.find(el => el.classList.contains('setlist-slot'));

    // ドラッグ中のクローン要素が存在しない場合（異常系）
    if (!currentTouchDraggedClone) {
        console.error("[handleTouchEnd] currentTouchDraggedClone is null despite isDragging being true. This is an unexpected state. Aborting drop.");
        showMessage("エラー: ドラッグ中の要素が見つかりませんでした。", "error");
        finishDragging(true); // キャンセル扱いとしてクリーンアップ
        return;
    }

    // ハイライトの解除は`finishDragging`で一括して行うため、ここでの`forEach`は不要
    // document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => slot.classList.remove('drag-over'));

    console.log("[handleTouchEnd] Drop target slot:", dropTargetSlot ? dropTargetSlot.dataset.slotIndex : "none (dropped outside setlist)");

    if (dropTargetSlot) {
        // `processDrop` は `currentTouchDraggedClone` からデータを取得し、
        // `originalSetlistSlot` の有無でアルバムからのドロップか、セットリスト内での移動かを判断する
        processDrop(currentTouchDraggedClone, dropTargetSlot, originalSetlistSlot);
    } else {
        // セットリスト外へのドロップ、または無効なドロップ
        console.log("[handleTouchEnd] Dropped outside a valid setlist slot. Performing cleanup as cancelled.");
        showMessage("セットリストの有効な位置にドロップしてください。", "error");
    }

    // ドロップが成功した場合も失敗した場合も、ここで最終的なクリーンアップを行う
    // `processDrop` 内で `finishDragging` を呼ぶと二重呼び出しになる可能性があるので、
    // ここで一元的に呼ぶのが安全（processDropはDOM操作のみに集中させる）
    finishDragging();
}


/**
 * タッチドラッグ中に表示するクローン要素を作成する。
 * @param {HTMLElement} originalElement - 元のドラッグ対象要素 (アルバムアイテムまたはセットリストアイテム)
 * @param {number} initialX - タッチ開始時のX座標
 * @param {number} initialY - タッチ開始時のY座標
 * @param {string} itemIdToClone - クローンに設定するitemId
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    // 既存のクローンがあれば削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove(); // DOMから削除
        currentTouchDraggedClone = null;
    }
    // 元の要素が有効でない場合は処理を中止
    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element is invalid or not in the document body. Aborting clone creation.");
        return;
    }

    // 元の要素を複製
    currentTouchDraggedClone = originalElement.cloneNode(true);
    // クラスを追加して、スタイリングと識別を容易にする
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block'; // 確実に表示されるように

    // 元の要素のデータセットをクローンにコピー
    // これにより、getSlotItemDataがクローンから正確な情報を取得できるようになる
    for (const key in originalElement.dataset) {
        currentTouchDraggedClone.dataset[key] = originalElement.dataset[key];
    }
    currentTouchDraggedClone.dataset.itemId = itemIdToClone; // itemIdを明確に設定

    // クローンをbodyに追加
    document.body.appendChild(currentTouchDraggedClone);

    // クローンの位置とスタイルを設定
    const rect = originalElement.getBoundingClientRect(); // 元の要素のサイズを取得
    Object.assign(currentTouchDraggedClone.style, {
        position: 'fixed', // 画面上の固定位置に表示
        zIndex: '10000',   // 他の要素の上に表示されるように高いz-indexを設定
        width: rect.width + 'px',   // 元の要素と同じ幅
        height: rect.height + 'px', // 元の要素と同じ高さ
        // タッチ開始位置を中心にクローンを配置
        left: (initialX - rect.width / 2) + 'px',
        top: (initialY - rect.height / 2) + 'px',
        pointerEvents: 'none', // クローン自身がイベントをブロックしないようにする
        opacity: '0.8', // ドラッグ中であることを示すために少し透明にする
        cursor: 'grabbing' // ドラッグ中のカーソル表示（デスクトップ環境でのデバッグ用）
    });
    console.log(`[createTouchDraggedClone] Clone created for itemId=${itemIdToClone} at (${currentTouchDraggedClone.style.left}, ${currentTouchDraggedClone.style.top})`);
}


/**
 * ドラッグ&ドロップの終了処理をまとめた関数。
 * @param {boolean} [isCancelled=false] - ドラッグがキャンセルされたかどうか。
 */
function finishDragging(isCancelled = false) {
    console.log("[finishDragging] Cleaning up dragging state. Is cancelled:", isCancelled);

    // 1. クローン要素の削除 (タッチドラッグ用)
    if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode) {
        currentTouchDraggedClone.parentNode.removeChild(currentTouchDraggedClone);
        currentTouchDraggedClone = null;
    }

    // 2. PCドラッグ中の要素のクラスと参照をリセット
    if (currentPcDraggedElement) {
        currentPcDraggedElement.classList.remove('dragging');
        // currentPcDraggedElement = null; // processDropの後でnullにするか、PCのdragendで管理
        // ここでは、PC dragend 時に this を使うことを想定し、あえて null にしない
    }

    // 3. 元の要素のvisibilityとplaceholderクラスを元に戻す
    if (originalSetlistSlot) { // セットリストからのドラッグの場合
        originalSetlistSlot.classList.remove('placeholder-slot');
        originalSetlistSlot.style.visibility = ''; // CSSで設定したvisibilityに戻す
        // originalSetlistSlot = null; // processDropの後でnullにするか、適切な場所でリセット
    } else if (currentTouchDraggedOriginalElement) { // アルバムアイテムからのタッチドラッグの場合
        currentTouchDraggedOriginalElement.style.visibility = ''; // アルバムアイテムを再表示
        // currentTouchDraggedOriginalElement = null; // processDropの後でnullにするか、適切な場所でリセット
    }

    // 4. ドラッグオーバーのハイライトをすべて解除
    document.querySelectorAll('.setlist-slot.drag-over').forEach(slot => {
        slot.classList.remove('drag-over');
    });

    // 5. ドラッグ終了時にすべてのセットリストスロットのpointer-eventsをリセットする
    // 空のスロットは pointer-events: none; に、アイテムが入っているスロットは pointer-events: auto; に戻す
    document.querySelectorAll('.setlist-slot').forEach(slot => {
        if (slot.classList.contains('setlist-item')) {
            slot.style.pointerEvents = 'auto'; // 曲が入っているスロットはイベントを許可
            slot.style.touchAction = 'pan-y'; // タッチスクロールも許可
        } else {
            slot.style.pointerEvents = 'none'; // 空のスロットはイベントをブロック
            slot.style.touchAction = 'none'; // touch-actionも無効にする
        }
    });

    // 6. ドラッグ関連のグローバル変数をリセット
    isDragging = false;
    draggingItemId = null;
    originalSetlistSlot = null; // 明示的にリセット
    currentTouchDraggedOriginalElement = null; // 明示的にリセット
    currentPcDraggedElement = null; // 明示的にリセット
    currentDropZone = null; // ドロップゾーンもリセット

    touchStartX = 0;
    touchStartY = 0;

    // 念のため、残っている可能性のあるタイムアウトもクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // 7. アルバムメニュー内のセットリストアイテムの表示/非表示を更新
    hideSetlistItemsInMenu();

    console.log("[finishDragging] Dragging state cleaned up.");
}


/**
 * ダブルクリック（またはダブルタップ）時の処理。
 * セットリストの曲をアルバムに戻す、または短縮/SEオプションなどを切り替える。
 * アルバムの曲をセットリストに追加する。
 * @param {HTMLElement} targetElement - ダブルクリックまたはダブルタップされた要素 (Event.targetではないことに注意)
 */
function handleDoubleClick(targetElement) {
    // event.preventDefault() は handleTouchStart で既に呼ばれているか、ここでは不要
    // （タッチイベントからの呼び出しを想定しているため、イベントオブジェクトは直接受け取らない）

    // イベントターゲットがチェックボックスの場合は何もしない（ここでは `targetElement` なので、`closest` は不要）
    // handleTouchStart の時点でチェックボックスならここに到達しないはず
    // ただし、念のためここでチェックを挟むことで、将来的な変更にも対応しやすくなる
    if (targetElement.closest('input[type="checkbox"]')) {
        console.log("[handleDoubleClick] Checkbox element or its parent double-clicked. Skipping custom action.");
        return;
    }


    // 最初に、ダブルクリックされた要素がアルバム内の曲かチェック
    // handleTouchStart から渡される場合は `album-content .item` が直接渡されることもある
    let albumItemElement = targetElement.closest('.album-content .item');
    if (albumItemElement) {
        console.log("[handleDoubleClick] Double-clicked an album item. Attempting to add to setlist.");
        // セットリストの最初の空きスロットを探す
        const firstEmptySlot = document.querySelector('#setlist .setlist-slot:not(.setlist-item)');
        if (firstEmptySlot) {
            const songData = getSlotItemData(albumItemElement);
            if (!songData) {
                console.warn("[handleDoubleClick] Could not get song data from album item. Aborting.");
                showMessage("曲のデータ取得に失敗しました。", "error");
                return;
            }

            addSongToSlot(firstEmptySlot, songData.itemId, songData.name, {
                isShortVersion: songData.hasShortOption,
                hasSeOption: songData.hasSeOption,
                drumsoloOption: songData.hasDrumsoloOption,
                rGt: songData.rGt,
                lGt: songData.lGt,
                bass: songData.bass,
                bpm: songData.bpm,
                chorus: songData.chorus,
                short: false, // アルバムからの追加なので、初期状態はfalse
                seChecked: false,
                drumsoloChecked: false
            }, songData.albumClass);
            showMessage("セットリストに曲を追加しました。", "success");
            hideSetlistItemsInMenu(); // メニュー内の重複を隠す
            saveSetlistState(); // 状態を保存
        } else {
            showMessage("セットリストに空きがありません。", "error");
        }
        return; // アルバムアイテムの処理が完了したので終了
    }

    // 次に、セットリストの曲がダブルクリックされたかチェック
    // handleTouchStart から渡される場合は `setlist-slot.setlist-item` が直接渡される
    let setlistItemElement = targetElement.closest('.setlist-slot.setlist-item');
    if (setlistItemElement) {
        console.log(`[handleDoubleClick] Double-clicked setlist item: ID=${setlistItemElement.dataset.itemId}, Slot Index=${setlistItemElement.dataset.slotIndex}. Restoring to original list.`);
        restoreToOriginalList(setlistItemElement); // この中で hideSetlistItemsInMenu と saveSetlistState も呼ばれる
        return; // 処理完了
    }

    console.log("[handleDoubleClick] No valid setlist item or album item found for double click. Target element was:", targetElement);
}



/**
 * チェックボックスとそのラベルのラッパー要素を作成するヘルパー関数。
 * @param {string} labelText - チェックボックスのラベルテキスト。
 * @param {boolean} isChecked - チェックボックスがチェックされているか。
 * @param {function} onChangeHandler - チェックボックスの状態が変更されたときに呼び出すハンドラ。
 * @param {string} optionType - オプションの種類 ('short', 'se', 'drumsolo') を識別するためのデータ属性値。
 * @returns {HTMLElement} 作成されたラッパー要素。
 */
function createCheckboxWrapper(labelText, isChecked, onChangeHandler, optionType) {
    const wrapper = document.createElement('label');
    wrapper.classList.add('checkbox-wrapper');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.dataset.optionType = optionType; // data-option-type をここで設定
    checkbox.addEventListener('change', onChangeHandler);

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    return wrapper;
}

/**
 * セットリストスロットの内容を更新（曲名とオプションの表示）。
 * この関数は、スロットのDOM構造を再構築し、データ属性に基づいて表示を更新します。
 * @param {HTMLElement} slotElement - 更新するセットリストスロット要素。
 * @param {string} songName - 表示する曲名。
 * @param {Object} options - 曲のオプション。
 * - `isShortVersion`: 短縮版オプションが「存在しうるか」 (boolean)
 * - `hasSeOption`: SEオプションが「存在しうるか」 (boolean)
 * - `drumsoloOption`: ドラムソロオプションが「存在しうるか」 (boolean)
 * - `rGt`, `lGt`, `bass`, `bpm`: チューニングやBPMの文字列
 * - `chorus`: コーラス情報 ('true'/'false'文字列)
 * - `short`: 短縮版が「現在チェックされているか」 (boolean)
 * - `seChecked`: SEが「現在チェックされているか」 (boolean)
 * - `drumsoloChecked`: ドラムソロが「現在チェックされているか」 (boolean)
 */
function updateSlotContent(slotElement, songName, options) {
    // 既存のコンテンツをクリア
    while (slotElement.firstChild) {
        slotElement.removeChild(slotElement.firstChild);
    }

    // song-info-container を作成
    const songInfoContainer = document.createElement('div');
    songInfoContainer.classList.add('song-info-container');

    // song-name-and-option を作成
    const songNameAndOption = document.createElement('div');
    songNameAndOption.classList.add('song-name-and-option');

    // 曲名要素
    const songNameSpan = document.createElement('span');
    songNameSpan.textContent = songName;
    songNameSpan.classList.add('song-name');
    songNameAndOption.appendChild(songNameSpan);

    // オプション要素 (チェックボックス) をラップするコンテナ
    const itemOptions = document.createElement('div');
    itemOptions.classList.add('item-options');

    let hasAnyCheckboxOption = false;

    // チェックボックスの状態変更ハンドラを一元化
    const handleCheckboxChange = (e) => {
        const checkbox = e.target;
        const optionType = checkbox.dataset.optionType;
        const isChecked = checkbox.checked;

        // dataset を更新
        if (optionType === 'short') {
            slotElement.dataset.short = isChecked.toString();
            slotElement.classList.toggle('short', isChecked);
        } else if (optionType === 'se') {
            slotElement.dataset.seChecked = isChecked.toString();
            slotElement.classList.toggle('se-active', isChecked);
        } else if (optionType === 'drumsolo') {
            slotElement.dataset.drumsoloChecked = isChecked.toString();
            slotElement.classList.toggle('drumsolo-active', isChecked);
        }

        // 新しいオプションオブジェクトを作成し、現在のチェック状態を更新して再描画
        const newOptions = { ...options };
        if (optionType === 'short') newOptions.short = isChecked;
        else if (optionType === 'se') newOptions.seChecked = isChecked;
        else if (optionType === 'drumsolo') newOptions.drumsoloChecked = isChecked;

        // DOM を更新して変更を反映
        updateSlotContent(slotElement, songName, newOptions);

        // 状態を保存
        saveSetlistState(); // ★重要: 状態変更を保存する

        console.log(`[updateSlotContent] Slot ${slotElement.dataset.slotIndex} ${optionType} status changed to: ${isChecked}`);
    };

    // 短縮版
    if (options.isShortVersion) {
        hasAnyCheckboxOption = true;
        const shortVersionCheckboxWrapper = createCheckboxWrapper('短縮', options.short, handleCheckboxChange, 'short');
        itemOptions.appendChild(shortVersionCheckboxWrapper);
    }

    // SE有無
    if (options.hasSeOption) {
        hasAnyCheckboxOption = true;
        const seOptionCheckboxWrapper = createCheckboxWrapper('SE', options.seChecked, handleCheckboxChange, 'se');
        itemOptions.appendChild(seOptionCheckboxWrapper);
    }

    // ドラムソロ有無
    if (options.drumsoloOption) {
        hasAnyCheckboxOption = true;
        const drumsoloOptionCheckboxWrapper = createCheckboxWrapper('ドラムソロ', options.drumsoloChecked, handleCheckboxChange, 'drumsolo');
        itemOptions.appendChild(drumsoloOptionCheckboxWrapper);
    }

    if (hasAnyCheckboxOption) {
        songNameAndOption.appendChild(itemOptions);
    }

    songInfoContainer.appendChild(songNameAndOption);

    // Additional Song Info (チューニング, BPM, コーラス)
    const additionalInfoDiv = document.createElement('div');
    additionalInfoDiv.classList.add('additional-song-info');

    let infoParts = [];
    if (options.rGt) infoParts.push(`R.GT: ${options.rGt}`);
    if (options.lGt) infoParts.push(`L.GT: ${options.lGt}`);
    if (options.bass) infoParts.push(`Ba: ${options.bass}`);
    if (options.bpm) infoParts.push(`BPM: ${options.bpm}`);
    if (options.chorus === 'true') infoParts.push(`コーラス`);

    if (infoParts.length > 0) {
        additionalInfoDiv.textContent = infoParts.join(' | ');
        songInfoContainer.appendChild(additionalInfoDiv);
    }

    slotElement.appendChild(songInfoContainer);

    // ドラッグハンドルの追加 (右端)
    const dragHandle = document.createElement('span');
    dragHandle.classList.add('drag-handle');
    dragHandle.textContent = '☰';
    slotElement.appendChild(dragHandle);

    // この関数はDOMを再構築するため、`enableDragAndDrop` をここで再度呼び出すのが適切です。
    // これにより、新しいDOM要素にもイベントリスナーが確実に付与されます。
    enableDragAndDrop(slotElement);
}


/**
 * セットリストの指定されたスロットに曲を追加する。
 * この関数はスロットにアイテムを「配置」し、そのデータ属性を初期化します。
 * @param {HTMLElement} slotElement - 曲を追加するセットリストのスロット要素。
 * @param {string} itemId - 曲のユニークなID。
 * @param {string} songName - 曲名。
 * @param {Object} options - 曲のオプション。
 * - `isShortVersion`: 短縮版オプションが「存在しうるか」 (boolean)
 * - `hasSeOption`: SEオプションが「存在しうるか」 (boolean)
 * - `drumsoloOption`: ドラムソロオプションが「存在しうるか` (boolean)
 * - `rGt`, `lGt`, `bass`, `bpm`: チューニングやBPMの文字列
 * - `chorus`: コーラス情報 ('true'/'false'文字列)
 * - `short`: 短縮版が「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `seChecked`: SEが「現在チェックされているか」 (boolean, 初回追加時はfalse)
 * - `drumsoloChecked`: ドラムソロが「現在チェックされているか` (boolean, 初回追加時はfalse)
 * @param {string} albumClass - 曲が属するアルバムのクラス名 (例: 'album1', 'album2')。
 */
function addSongToSlot(slotElement, itemId, songName, options, albumClass) {
    console.log(`[addSongToSlot] Adding song ${songName} (${itemId}) to slot ${slotElement.dataset.slotIndex}. Album: ${albumClass}`);
    console.log(`[addSongToSlot] Options received:`, options);

    // スロットの内容をクリア
    clearSlotContent(slotElement);

    // スロットに setlist-item クラスを追加し、albumClassも追加
    slotElement.classList.add('setlist-item', 'item', albumClass);

    // 新しい曲要素のデータ属性を設定
    slotElement.dataset.itemId = itemId;
    slotElement.dataset.songName = songName;

    // オプションが「存在しうるか」を示すデータ属性
    slotElement.dataset.isShortVersion = options.isShortVersion ? 'true' : 'false';
    slotElement.dataset.hasSeOption = options.hasSeOption ? 'true' : 'false';
    slotElement.dataset.drumsoloOption = options.drumsoloOption ? 'true' : 'false';

    // チューニングやBPMは文字列としてそのまま保存
    slotElement.dataset.rGt = options.rGt || '';
    slotElement.dataset.lGt = options.lGt || '';
    slotElement.dataset.bass = options.bass || '';
    slotElement.dataset.bpm = options.bpm || '';
    slotElement.dataset.chorus = options.chorus || 'false';

    // チェックボックスの現在の状態を示すデータ属性
    slotElement.dataset.short = options.short ? 'true' : 'false';
    slotElement.dataset.seChecked = options.seChecked ? 'true' : 'false';
    slotElement.dataset.drumsoloChecked = options.drumsoloChecked ? 'true' : 'false';

    // チェックボックスの初期状態に応じてクラスも設定
    slotElement.classList.toggle('short', options.short);
    slotElement.classList.toggle('se-active', options.seChecked);
    slotElement.classList.toggle('drumsolo-active', options.drumsoloChecked);

    // スロットの pointer-events を 'auto' に設定（これでタップ・ドラッグ可能になる）
    slotElement.style.pointerEvents = 'auto';
    slotElement.style.touchAction = 'pan-y'; // タッチスクロールを許可

    // スロットのコンテンツを更新（曲名やオプションの表示）
    // updateSlotContent には options オブジェクトをそのまま渡す
    updateSlotContent(slotElement, songName, options);

    // スロットにアイテムが追加されたので、状態を保存
    saveSetlistState(); // ★重要: 状態変更を保存する

    console.log(`[addSongToSlot] Successfully added song ${songName} to slot ${slotElement.dataset.slotIndex}.`);
}






// =============================================================================
// イベントリスナーの登録と初期化
// =============================================================================

/**
 * ドラッグ＆ドロップとダブルクリックを有効にする関数。
 * この関数は、指定された要素にPCおよびタッチイベントリスナーを設定します。
 * 要素が動的に追加/更新される際に呼び出されます。
 * @param {Element} element - 有効にする要素（アルバムリストのアイテムまたはセットリストのスロット）
 */
function enableDragAndDrop(element) {
    // 既存のリスナーを削除してから追加することで、二重登録を防ぐ
    // `removeEventListener` は、同じ関数参照とオプションを渡さないと正しく動作しないことに注意。
    // 特に `{ passive: false }` のようなオプションは一致させる必要がある。
    element.removeEventListener("dragstart", handleDragStart);
    element.removeEventListener("touchstart", handleTouchStart, { passive: false });
    element.removeEventListener("touchmove", handleTouchMove, { passive: false });
    element.removeEventListener("touchend", handleTouchEnd); // touchend/touchcancel は passive true/false どちらでも可だが、一貫性を保つ
    element.removeEventListener("touchcancel", handleTouchEnd);
    element.removeEventListener("dblclick", handleDoubleClick);
    element.removeEventListener("dragover", handleDragOver);
    element.removeEventListener("drop", handleDrop);
    element.removeEventListener("dragenter", handleDragEnter);
    element.removeEventListener("dragleave", handleDragLeave);

    // 'item' または 'setlist-item' クラスを持つ要素にドラッグ＆ドロップとダブルクリックを設定
    if (element.classList.contains('item') || element.classList.contains('setlist-item')) {
        // itemIdがまだ設定されていなければ生成 (アルバムアイテム用)
        if (!element.dataset.itemId) {
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        // songNameがまだ設定されていなければテキストコンテンツから取得
        if (!element.dataset.songName) {
            // スロット内のsong-nameスパンから取得するように変更 (より正確)
            const songNameSpan = element.querySelector('.song-name');
            if (songNameSpan) {
                element.dataset.songName = songNameSpan.textContent.trim();
            } else {
                element.dataset.songName = element.textContent.trim(); // フォールバック
            }
        }
        element.draggable = true; // PCドラッグを有効化

        // PCドラッグイベントリスナー
        element.addEventListener("dragstart", handleDragStart); // handlePcDragStart と統合された handleDragStart を使用

        // タッチイベントリスナー (ここでは個々の要素に設定)
        // touchstart では preventDefault を使う可能性があるため passive: false
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        // touchend と touchcancel は passive: false をつけても問題ないが、デフォルトは passive: true なので注意
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);

        // ダブルクリック/ダブルタップイベントリスナー
        // ★重要: handleDoubleClick 関数は event オブジェクトではなく、要素を直接受け取るように変更されているので注意
        element.addEventListener("dblclick", (e) => {
            // チェックボックスなどの子要素でのダブルクリックを無視するロジック
            if (e.target.closest('input[type="checkbox"]')) {
                console.log("[dblclick listener] Checkbox double-clicked. Skipping custom action.");
                return;
            }
            handleDoubleClick(element); // イベントターゲットではなく、対象の要素自体を渡す
        });
    }

    // 'setlist-slot' クラスを持つ要素にドロップゾーン機能を設定
    if (element.classList.contains('setlist-slot')) {
        element.addEventListener("dragover", handleDragOver); // handlePcDragOver と統合された handleDragOver を使用
        element.addEventListener("drop", handleDrop);         // handlePcDrop と統合された handleDrop を使用
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
        // セットリストスロットが空の場合、pointer-events: none; に設定する (DOMReadyとfinishDraggingで最終的に制御)
        // enableDragAndDropが呼ばれた時点では、まだアイテムが入っていない可能性もあるため、
        // ここで一律に none にはせず、finishDragging()とloadSetlistState()に任せるのが安全
    }
}

// ページロード時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application.");

    // --- ドラッグ＆ドロップ関連の初期設定 ---
    // アルバム内のアイテムにドラッグ＆ドロップ機能を有効化
    document.querySelectorAll(".album-content .item").forEach(item => {
        enableDragAndDrop(item); // enableDragAndDrop関数でPCとタッチ両方のイベントリスナーを設定
    });

    // セットリストのスロットに初期設定を適用
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
        if (!slot.dataset.slotIndex) {
            slot.dataset.slotIndex = index.toString();
        }
        enableDragAndDrop(slot); // enableDragAndDrop関数でドロップゾーンリスナーとDblClickを設定
    });

    // Global dragend listener (PCドラッグ終了時のクリーンアップ)
    // ドラッグ＆ドロップのクリーンアップは `finishDragging` で一元的に行われるため、
    // PCの `dragend` イベントも `finishDragging` を呼ぶように調整。
    // ただし、PCのdragendでは `event.target` が元の要素になるため、
    // その情報を使って `finishDragging` を呼ぶ必要があるかもしれません。
    // 現状 `finishDragging` がグローバル変数に依存しているので、このままでOK。
    document.addEventListener("dragend", handlePcDragEnd); // handlePcDragEnd が finishDragging を呼ぶことを想定

    // ★修正点1: チェックボックスイベントリスナーは `updateSlotContent` 内の `handleCheckboxChange` で処理されます。
    // ここで個別の `slot.addEventListener('click', ...)` は不要、または `handleDoubleClick` と競合する可能性があります。
    // `updateSlotContent` が DOM を再構築し、そこでイベントリスナーを再付与するため、
    // ここで一括で設定するより、動的に追加される要素に対するイベントリスナーは、
    // その要素を生成/更新する関数内で設定するのが安全かつ適切です。
    // したがって、以下のクリックリスナーは削除することを推奨します。
    // slot.addEventListener('click', (e) => { ... });

    // グローバルなタッチイベントリスナーは、個々の要素ではなくドキュメントレベルで管理されるべきです。
    // これにより、要素の動的な追加・削除に関わらずイベントを捕捉できます。
    // ただし、特定の要素に対するイベントは、その要素に直接設定されるべきです。
    // 現在の `enableDragAndDrop` で個々の要素にタッチリスナーを設定しているため、
    // ここでの `document.addEventListener` は、タッチドラッグ全体を制御する場合にのみ意味を持ちます。
    // 例えば、`handleTouchStart` で `event.preventDefault()` を呼ぶために `passive: false` が必要ですが、
    // これは `enableDragAndDrop` で設定されているので、ここで重複して設定する必要はありません。
    // したがって、以下の `document.addEventListener("touchstart", ...)` は削除することを推奨します。
    // document.addEventListener("touchstart", handleTouchStart, { passive: false });
    // document.addEventListener("touchmove", handleTouchMove, { passive: false });
    // document.addEventListener("touchend", handleTouchEnd, { passive: false });
    // document.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    // --- 日付ドロップダウンの初期化と設定 ---
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    if (setlistYear && setlistMonth && setlistDay) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 30; // 過去30年
        const endYear = currentYear + 5;   // 未来5年

        // 年のオプションを追加
        for (let i = endYear; i >= startYear; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            setlistYear.appendChild(option);
        }

        // 月のオプションを追加
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0'); // '01', '02'のように2桁に
            option.textContent = i;
            setlistMonth.appendChild(option);
        }

        // 日付選択要素の変更イベントリスナー
        // 日付が変わったら必ず saveSetlistState を呼び出すようにする
        setlistYear.addEventListener('change', () => { updateDays(); saveSetlistState(); });
        setlistMonth.addEventListener('change', () => { updateDays(); saveSetlistState(); });
        setlistDay.addEventListener('change', () => { saveSetlistState(); });

        // `updateDays` は初期ロード時に `loadSetlistState` の中で呼ばれる `updateDatePickersToToday` か、
        // あるいは直接呼ばれるべき。ここでは単にオプションを生成するだけ。
        // 初期選択は `loadSetlistState` 内で処理されるか、`updateDatePickersToToday` で。
        // updateDays(); // ここで呼び出すと、ロードされる日付よりも優先される可能性がある
    } else {
        console.warn("[DOMContentLoaded] Date dropdown elements (setlistYear, setlistMonth, setlistDay) not found.");
    }


    // --- モーダル関連の初期設定 ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModalOverlay');
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton');

    const openSpecificYearModalButton = document.getElementById('open2025FromPastModalButton');
    const specificYearDetailModal = document.getElementById('year2025DetailModal');
    const closeSpecificYearDetailModalButton = document.getElementById('close2025DetailModalButton');


    // 「過去セットリスト」モーダルの開閉
    if (openPastSetlistsModalButton && pastSetlistsModal) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.add('active');
            populatePastYears(); // モーダルを開くときに年リストを生成
        });
        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) { // オーバーレイ自体がクリックされたら閉じる
                pastSetlistsModal.classList.remove('active');
            }
        });
        if (closePastSetlistsModalButton) {
            closePastSetlistsModalButton.addEventListener('click', () => pastSetlistsModal.classList.remove('active'));
        }
    }

    // 特定年詳細モーダルの開閉 (例として2025年、他の年にも適用するなら関数化/汎用化を推奨)
    if (openSpecificYearModalButton && specificYearDetailModal) {
        openSpecificYearModalButton.addEventListener('click', () => {
            if (pastSetlistsModal) pastSetlistsModal.classList.remove('active'); // 親モーダルを閉じる
            specificYearDetailModal.classList.add('active');
            // populateSpecificYearSetlists(2025); // 2025年のセットリストをロードする関数を呼び出し
        });
        if (closeSpecificYearDetailModalButton) {
            closeSpecificYearDetailModalButton.addEventListener('click', () => specificYearDetailModal.classList.remove('active'));
        }
        specificYearDetailModal.addEventListener('click', (event) => {
            if (event.target === specificYearDetailModal) {
                specificYearDetailModal.classList.remove('active');
            }
        });
    }

    // モーダル内の setlist-link のクリックハンドラ (共有IDのロードとモーダルクローズ)
    // ★動的に生成される要素に対するイベントリスナーは、親要素へのイベント委譲がベストプラクティス
    document.addEventListener('click', (event) => {
        const link = event.target.closest('.setlist-link');
        if (link) {
            const shareIdMatch = link.href.match(/\?shareId=([^&]+)/);
            if (shareIdMatch) {
                event.preventDefault(); // デフォルトのリンク動作を防止
                const shareId = shareIdMatch[1];
                const newUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
                window.history.pushState({ path: newUrl }, '', newUrl);

                loadSetlistState().then(() => {
                    console.log(`[setlist-link click] Setlist loaded from shareId: ${shareId}`);
                    // ロードが完了したら、関連するモーダルが閉じていることを確認
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (specificYearDetailModal) specificYearDetailModal.classList.remove('active');
                    showMessage("セットリストをロードしました！", "success");
                }).catch(error => {
                    console.error("[setlist-link click] Error loading setlist:", error);
                    showMessage("セットリストのロードに失敗しました。", "error");
                });
            } else {
                // `target.closest` を使っているので、他のリンクがクリックされてもここに来る
                // SPA の場合、デフォルト動作を防止すべきだが、ここでは現状維持。
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                // 通常のリンクの場合もモーダルを閉じる
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                if (specificYearDetailModal) specificYearDetailModal.classList.remove('active');
            }
        }
    });

    // --- 最終クリーンアップと初期ロード ---
    // `loadSetlistState` は Promise を返すので、`then` を使って確実に後続処理を実行
    loadSetlistState().then(() => {
        console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup and UI updates.");
        hideSetlistItemsInMenu(); // セットリストに存在する曲をアルバムリストから非表示にする

        // 初期ロード後、すべてのセットリストスロットのpointer-eventsを適切に設定
        // これは `finishDragging` 関数で一元的に制御されるのが理想的ですが、
        // 初期ロード時にも明示的に設定することで、状態の一貫性を保ちます。
        document.querySelectorAll('.setlist-slot').forEach(slot => {
            if (slot.classList.contains('setlist-item')) {
                slot.style.pointerEvents = 'auto';
                slot.style.touchAction = 'pan-y';
            } else {
                slot.style.pointerEvents = 'none';
                slot.style.touchAction = 'none';
            }
        });

        // 日付ピッカーの初期表示設定は `loadSetlistState` または `updateDatePickersToToday` で処理されるべき
        // ここでの localStorage からの復元ロジックは、Firebaseロードより優先される可能性があるため、注意が必要です。
        // Firebaseからのロードが優先されるように、`loadSetlistState` の中で日付設定を行うのが最も安全です。
        // もしFirebaseに日付情報がない場合のみ localStorage や `updateDatePickersToToday` を使用するロジックが望ましい。
        // 現状、`loadSetlistState` 内で `updateDatePickersToToday` が呼ばれているので、重複を避けるため、
        // このlocalStorageの復元部分はコメントアウトするか削除を検討してください。
        /*
        const setlistInfo = JSON.parse(localStorage.getItem("currentSetlist") || '{}');
        const savedDate = setlistInfo.date || '';
        if (savedDate) {
            const [year, month, day] = savedDate.split('/').map(Number);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                setlistYear.value = year;
                setlistMonth.value = String(month).padStart(2, '0');
                updateDays(true, day); // `true`で選択モード、`day`で選択する日を指定
            }
        } else {
            // 保存された日付がない場合、今日の日付をデフォルトで設定
            const today = new Date();
            setlistYear.value = today.getFullYear();
            setlistMonth.value = String(today.getMonth() + 1).padStart(2, '0');
            updateDays(true, today.getDate());
        }
        */

    }).catch(error => {
        console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
        hideSetlistItemsInMenu(); // エラー時もアルバムメニューの表示を更新
    });
});

// --- ヘルパー関数（DOMContentLoadedスコープ外で定義するか、適切な場所に移動） ---

// updateDays 関数
// `updateDays` は日付ドロップダウンのオプションを更新し、選択状態を調整します。
// `selectSavedDay` が `true` の場合、`savedDay` に基づいて選択し、
// それ以外の場合は今日の日付、または月の1日を選択します。
function updateDays(selectSavedDay = false, savedDay = null) { // savedDay のデフォルト値を null に変更
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

    if (!setlistYear || !setlistMonth || !setlistDay) {
        console.warn("[updateDays] Date select elements not found. Cannot update days.");
        return;
    }

    const year = parseInt(setlistYear.value);
    const month = parseInt(setlistMonth.value);

    // 日のオプションをクリア
    setlistDay.innerHTML = '';

    if (isNaN(year) || isNaN(month)) {
        // 年または月がまだ選択されていない場合は、日のオプションを空にするか、何もしない
        return;
    }

    // 選択された年月の最終日を取得
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i;
        setlistDay.appendChild(option);
    }

    // 選択状態の調整
    if (selectSavedDay && savedDay !== null) {
        // ロードされた特定の日を選択
        setlistDay.value = String(savedDay).padStart(2, '0');
    } else {
        // 保存された日付がない場合、または月/年が変更された場合
        const today = new Date();
        // 現在表示されている年月に今日が含まれるか
        if (today.getFullYear() === year && (today.getMonth() + 1) === month) {
            const currentDay = today.getDate();
            // 今日の日付がその月の最大日数を超えないかチェック
            if (currentDay <= daysInMonth) {
                setlistDay.value = String(currentDay).padStart(2, '0');
            } else {
                setlistDay.value = '01'; // 今日の日付が月の最大日数を超えていたら1日を選択
            }
        } else {
            // 現在の年月が今日ではない場合、または保存された日がない場合、デフォルトで1日を選択
            setlistDay.value = '01';
        }
    }
    console.log(`[updateDays] Days updated for ${year}-${month}. Max days: ${daysInMonth}. Selected day: ${setlistDay.value}`);
    // ここで saveSetlistState() を呼ぶのは、`loadSetlistState` と競合する可能性があるため、
    // 日付選択の `change` イベントリスナーで個別に呼び出す方が安全です。
    // saveSetlistState();
}

// getSlotItemData 関数 (スロットからアイテムデータを取得)
// この関数は、データ属性から情報を正確に取得するように修正する必要があります。
// updateSlotContent や addSongToSlot で設定したデータ属性に対応させます。
function getSlotItemData(element) {
    // スロット要素か、スロット内のアイテム要素かを判別
    const targetElement = element.classList.contains('setlist-slot') || element.classList.contains('album-item') ? element : element.closest('.setlist-slot') || element.closest('.album-item');

    if (!targetElement || !targetElement.dataset.itemId) {
        return null;
    }

    // dataset から直接データを取得
    return {
        itemId: targetElement.dataset.itemId,
        // albumId は通常アルバムアイテムにのみ設定されるが、ここでは汎用的に取得
        albumId: targetElement.dataset.albumId || targetElement.classList.contains('album1') ? 'album1' : (targetElement.classList.contains('album2') ? 'album2' : ''), // 仮のalbumId取得
        name: targetElement.dataset.songName, // `name` プロパティとして
        rGt: targetElement.dataset.rGt || '',
        lGt: targetElement.dataset.lGt || '',
        bass: targetElement.dataset.bass || '',
        bpm: targetElement.dataset.bpm || '',
        chorus: targetElement.dataset.chorus || 'false', // 'true'/'false'文字列
        // オプションが「存在しうるか」
        hasShortOption: targetElement.dataset.isShortVersion === 'true',
        hasSeOption: targetElement.dataset.hasSeOption === 'true',
        hasDrumsoloOption: targetElement.dataset.drumsoloOption === 'true',
        // チェックボックスの現在の状態 (booleanに変換)
        short: targetElement.dataset.short === 'true',
        seChecked: targetElement.dataset.seChecked === 'true',
        drumsoloChecked: targetElement.dataset.drumsoloChecked === 'true'
    };
}