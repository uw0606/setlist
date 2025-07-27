// =======================================================================================
// グローバル変数と定数
// =======================================================================================

// タッチ/ドラッグ関連のグローバル変数
let startTouchPos = { x: 0, y: 0 }; // タッチ開始位置
let touchTimeout = null;            // 長押し判定用タイマーID
let lastTapTime = 0;                // ダブルタップ判定用
let rafId = null;                   // requestAnimationFrame のIDを保持
let lastTapTarget = null;           // ダブルタップ判定用：最後にタップされた要素

// ドラッグ＆ドロップ関連のグローバル変数
let draggingItemId = null;          // 現在ドラッグ中のアイテムID
let originalSetlistSlot = null;     // セットリストからドラッグした場合の元のスロット
let currentPcDraggedElement = null; // PCドラッグで使われる元の要素 (アルバム or セットリスト)
let currentTouchDraggedClone = null; // モバイルドラッグ用のクローン要素
let currentDropZone = null;         // 現在ドラッグオーバーしているドロップゾーン
let activeTouchSlot = null;         // 現在タッチされているスロット（長押し判定用）
let isDragging = false;             // ドラッグ中かどうかを示すフラグ

// ドロップ関連のマップ (アイテムがどのアルバムから来たかを追跡)
const originalAlbumMap = new Map();

// UI要素の参照
const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.querySelector(".album-list"); // 使われていないが、残しておく
const maxSongs = 26; // セットリストの最大曲数

// 長押し・ドラッグの閾値
const LONG_PRESS_THRESHOLD = 500; // 500ミリ秒 (0.5秒) を長押しの閾値とする
const DRAG_THRESHOLD = 10;        // ドラッグ開始に必要な移動距離 (ピクセル) の閾値


// =======================================================================================
// ダミーデータ (実際のアプリケーションでは外部ファイルからロードされるべき)
// =======================================================================================
let albumItemsData = []; // この配列にすべてのアルバムアイテムデータがロードされると仮定

// 仮のアルバムデータ（実際にはdata/album_data.jsonなどからロード）
// このダミーデータは getAlbumItemData で使用される想定ですが、
// 現在の getSlotItemData はDOMから直接データを読み取るため、
// 将来的には getAlbumItemData の呼び出しが適切に置き換えられることを想定します。
const DUMMY_ALBUM_ITEM_DATA = {
    'album2-001': { name: 'CHANCE!', short: false, seChecked: false, drumsoloChecked: false, hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false, rGt: 'Drop D', lGt: 'Drop D', bass: 'Drop D', bpm: 128, chorus: 'あり' },
    'album2-002': { name: 'トキノナミダ', short: false, seChecked: false, drumsoloChecked: false, hasShortOption: false, hasSeOption: false, hasDrumsoloOption: false, rGt: 'Drop B', lGt: 'Drop B', bass: '5 REG', bpm: 198, chorus: 'あり' },
    // 他のアイテムデータもここに追加するか、実際のデータソースから取得
};

/**
 * ダミーのアルバムアイテムデータを取得する関数 (デバッグ用または代替用)
 * 実際のプロジェクトでは `albumItemsData` から検索されるべきです。
 * @param {string} itemId - 検索するアイテムのID
 * @returns {object|null} 曲のデータオブジェクト、またはnull
 */
function getAlbumItemData(itemId) {
    // 実際の `albumItemsData` 配列から検索するロジックに置き換えるべき
    // return albumItemsData.find(item => item.itemId === itemId) || null;
    return DUMMY_ALBUM_ITEM_DATA[itemId] || null;
}

// =======================================================================================
// ヘルパー関数
// =======================================================================================

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

    // datasetから直接取得できるプロパティ
    const itemId = element.dataset.itemId || '';
    const songName = element.dataset.songName || element.textContent.trim(); // Fallback for album items
    const albumClass = Array.from(element.classList).find(className => className.startsWith('album')) || '';

    // チェックボックスの状態 (セットリストアイテムやクローンにのみ存在する可能性)
    // datasetから直接取得する場合
    const isCheckedShort = element.dataset.short === 'true';
    const isCheckedSe = element.dataset.seChecked === 'true';
    const isCheckedDrumsolo = element.dataset.drumsoloChecked === 'true';

    // オプションの有無 (datasetから直接取得)
    const hasShortOption = element.dataset.isShortVersion === 'true';
    const hasSeOption = element.dataset.hasSeOption === 'true';
    const hasDrumsoloOption = element.dataset.hasDrumsoloOption === 'true';

    // その他のデータ属性
    const rGt = element.dataset.rGt || '';
    const lGt = element.dataset.lGt || '';
    const bass = element.dataset.bass || '';
    const bpm = element.dataset.bpm || '';
    const chorus = element.dataset.chorus || '';
    const slotIndex = element.dataset.slotIndex ? parseInt(element.dataset.slotIndex, 10) : undefined;


    // セットリストアイテムの場合、チェックボックスの現在の状態をDOMから取得
    if (element.classList.contains('setlist-item')) {
        const shortCheckbox = element.querySelector('input[type="checkbox"][data-option-type="short"]');
        const seCheckbox = element.querySelector('input[type="checkbox"][data-option-type="se"]');
        const drumsoloCheckbox = element.querySelector('input[type="checkbox"][data-option-type="drumsolo"]');

        return {
            name: songName,
            short: shortCheckbox ? shortCheckbox.checked : isCheckedShort,
            seChecked: seCheckbox ? seCheckbox.checked : isCheckedSe,
            drumsoloChecked: drumsoloCheckbox ? drumsoloCheckbox.checked : isCheckedDrumsolo,
            hasShortOption: hasShortOption,
            hasSeOption: hasSeOption,
            hasDrumsoloOption: hasDrumsoloOption,
            albumClass: albumClass,
            itemId: itemId,
            slotIndex: slotIndex,
            rGt: rGt,
            lGt: lGt,
            bass: bass,
            bpm: bpm,
            chorus: chorus
        };
    } else {
        // アルバムアイテムやクローン要素の場合、datasetから取得した値をそのまま使用
        return {
            name: songName,
            short: isCheckedShort,
            seChecked: isCheckedSe,
            drumsoloChecked: isCheckedDrumsolo,
            hasShortOption: hasShortOption,
            hasSeOption: hasSeOption,
            hasDrumsoloOption: hasDrumsoloOption,
            albumClass: albumClass,
            itemId: itemId,
            slotIndex: slotIndex,
            rGt: rGt,
            lGt: lGt,
            bass: bass,
            bpm: bpm,
            chorus: chorus
        };
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

/**
 * セットリストのスロットの内容をクリアする。
 * @param {number} slotIndex - クリアするスロットのインデックス
 */
function clearSlotContent(slotIndex) {
    const slotElement = setlist.querySelector(`.setlist-slot[data-slot-index="${slotIndex}"]`);
    if (!slotElement) {
        console.warn(`[clearSlotContent] Slot element with index ${slotIndex} not found.`);
        return false;
    }

    const itemId = slotElement.dataset.itemId;
    if (itemId) {
        console.log(`[clearSlotContent] Clearing slot ${slotIndex} (item ID: ${itemId}).`);
        // クラスとデータ属性を削除して、空の状態に戻す
        slotElement.classList.remove('setlist-item', 'item', 'short', 'se-active', 'drumsolo-active');
        Array.from(slotElement.classList).forEach(cls => {
            if (cls.startsWith('album')) {
                slotElement.classList.remove(cls);
            }
        });

        // datasetの値を削除
        delete slotElement.dataset.itemId;
        delete slotElement.dataset.songName;
        delete slotElement.dataset.short;
        delete slotElement.dataset.seChecked;
        delete slotElement.dataset.drumsoloChecked;
        delete slotElement.dataset.isShortVersion;
        delete slotElement.dataset.hasSeOption;
        delete slotElement.dataset.hasDrumsoloOption;
        delete slotElement.dataset.rGt;
        delete slotElement.dataset.lGt;
        delete slotElement.dataset.bass;
        delete slotElement.dataset.bpm;
        delete slotElement.dataset.chorus;

        const songInfoContainer = slotElement.querySelector('.song-info-container');
        if (songInfoContainer) {
            songInfoContainer.remove(); // 曲情報コンテナを完全に削除
        }

        // ドラッグイベントリスナーを削除 (空になったのでドラッグ元にはならない)
        slotElement.draggable = false;
        slotElement.removeEventListener("dragstart", handleDragStart);
        slotElement.removeEventListener("touchstart", handleTouchStart);
        slotElement.removeEventListener("touchmove", handleTouchMove);
        slotElement.removeEventListener("touchend", handleTouchEnd);
        slotElement.removeEventListener("touchcancel", handleTouchEnd);

        // アルバムマップからアイテムを削除
        if (originalAlbumMap.has(itemId)) {
            originalAlbumMap.delete(itemId);
            console.log(`[clearSlotContent] Deleted ${itemId} from originalAlbumMap.`);
        }
        return true;
    } else {
        console.log(`[clearSlotContent] Slot ${slotIndex} is already empty.`);
        return false;
    }
}

/**
 * アイテムを元のアルバムリストに戻し、セットリストから削除する。
 * @param {Element|object} itemOrElementToProcess - セットリストから戻す、または削除する対象の要素（元のセットリストスロット要素、モバイルのクローン要素など、itemIdを持つもの）、またはアイテムデータオブジェクト
 */
function restoreToOriginalList(itemOrElementToProcess) {
    let itemId;
    let slotIndexToClear = -1;

    if (itemOrElementToProcess instanceof Element) {
        itemId = itemOrElementToProcess.dataset.itemId;
        if (itemOrElementToProcess.classList.contains('setlist-item')) {
            slotIndexToClear = parseInt(itemOrElementToProcess.dataset.slotIndex, 10);
        }
    } else if (typeof itemOrElementToProcess === 'object' && itemOrElementToProcess !== null && itemOrElementToProcess.itemId) {
        itemId = itemOrElementToProcess.itemId;
        if (itemOrElementToProcess.slotIndex !== undefined) {
             slotIndexToClear = parseInt(itemOrElementToProcess.slotIndex, 10);
        }
    } else {
        console.warn(`[restoreToOriginalList] Invalid input for restoration:`, itemOrElementToProcess);
        return;
    }

    if (!itemId) {
        console.warn(`[restoreToOriginalList] No valid item ID found for restoration. Input:`, itemOrElementToProcess);
        // モバイルのクローンが宙ぶらりんの場合のクリーンアップ
        if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
            currentTouchDraggedClone.remove();
            currentTouchDraggedClone = null;
            console.log("[restoreToOriginalList] Removed temporary currentTouchDraggedClone from body due to no item ID.");
        }
        return;
    }

    console.log(`[restoreToOriginalList] Attempting to restore item ID: ${itemId}.`);

    // アルバムメニュー内の元アイテムを表示
    const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
    if (albumItemInMenu) {
        albumItemInMenu.style.visibility = ''; // 表示状態に戻す
        console.log(`[restoreToOriginalList] Original album item found and displayed: ${itemId}`);
    } else {
        console.warn(`[restoreToOriginalList] Original album item for ID: ${itemId} not found in menu to display.`);
    }

    // セットリスト内のスロットをクリア
    if (slotIndexToClear !== -1) {
        const slotToClearInSetlist = setlist.querySelector(`.setlist-slot[data-slot-index="${slotIndexToClear}"]`);
        if (slotToClearInSetlist && slotToClearInSetlist.dataset.itemId === itemId) { // 確実にそのアイテムがそこにあるか確認
            console.log(`[restoreToOriginalList] Clearing content from setlist slot: ${slotIndexToClear}`);
            clearSlotContent(slotIndexToClear);
        } else {
            console.log(`[restoreToOriginalList] Item ${itemId} was not in setlist slot ${slotIndexToClear} (or slot empty), no slot to clear.`);
        }
    }

    // originalAlbumMapからアイテムを削除
    if (originalAlbumMap.has(itemId)) {
        originalAlbumMap.delete(itemId);
        console.log(`[restoreToOriginalList] Deleted ${itemId} from originalAlbumMap.`);
    }
}

/**
 * セットリスト内のアイテムをアルバムメニューから非表示にする。
 * この関数は、loadSetlistStateの完了後、または通常読み込み時に呼び出される。
 */
function hideSetlistItemsInMenu() {
    const allAlbumItems = document.querySelectorAll('.album-content .item');
    console.log("[hideSetlistItemsInMenu] START: Hiding setlist items in album menu.");

    // まず全てのアルバムアイテムをデフォルトの表示状態に戻す（念のため）
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

/**
 * セットリストの内容を取得する（共有用テキスト生成など）。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
  const currentSetlist = Array.from(document.querySelectorAll("#setlist .setlist-slot.setlist-item"))
    .map((slot, index) => {
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

        if (songData.rGt || songData.lGt || songData.bass) {
            line += ` (A.Gt:${songData.rGt||''} K.Gt:${songData.lGt||''} B:${songData.bass||''})`;
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

/**
 * 現在のアプリケーション状態を収集する。
 * @returns {object} 現在の状態を示すオブジェクト
 */
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

  const setlistVenue = document.getElementById('setlistVenue')?.value || '';

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

/**
 * 日のドロップダウンを更新する関数。
 */
const updateDays = () => {
    const setlistYear = document.getElementById('setlistYear');
    const setlistMonth = document.getElementById('setlistMonth');
    const setlistDay = document.getElementById('setlistDay');

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

/**
 * 次の空いているセットリストスロットを見つける。
 * @returns {number} 空いているスロットのインデックス。見つからない場合は -1。
 */
function findNextEmptySetlistSlot() {
    const setlistSlots = document.querySelectorAll('.setlist-slot');
    for (let i = 0; i < setlistSlots.length; i++) {
        const slot = setlistSlots[i];
        if (!slot.classList.contains('setlist-item')) {
            console.log(`[findNextEmptySetlistSlot] Found empty slot at index: ${i}`);
            return i;
        }
    }
    console.log("[findNextEmptySetlistSlot] No empty setlist slot found.");
    return -1;
}

/**
 * 日本語フォントをjsPDFに登録するプレースホルダー関数。
 * 実際のPDF出力で日本語を使用する場合は、`jspdf.plugin.autotable.js` の後に `jspdf.customfonts.js` または
 * `jspdf.vfs.js` と `NotoSansJP-normal.js` などのフォントファイルをロードし、
 * フォント名を正しく設定する必要があります。
 * @param {object} doc - jsPDFドキュメントインスタンス
 */
function registerJapaneseFont(doc) {
    // ⚠️ 注意: この関数はフォントファイルが事前にロードされていることを前提としています。
    // 例: <script src="path/to/fonts/NotoSansJP-normal.js"></script>
    // あるいは、jspdf-autotable の `addFont` オプションで登録
    console.warn("[registerJapaneseFont] Japanese font registration is a placeholder. Please ensure 'NotoSansJP' font files are correctly embedded/loaded for actual PDF output with Japanese characters.");
    // 以下は、jsPDFとautoTableがNotoSansJPフォントを認識するための典型的な設定例です。
    // doc.addFont('path/to/NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    // doc.addFont('path/to/NotoSansJP-Bold.ttf', 'NotoSansJP', 'bold');
}


// =======================================================================================
// UI操作関数と状態管理
// =======================================================================================

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
 * セットリストのスロットを曲情報で埋める。
 * @param {Element} slotElement - 対象のスロット要素 (li.setlist-slot)
 * @param {object} songData - スロットに入れる曲のデータオブジェクト
 * 例: { itemId: "...", name: "曲名", albumClass: "...", short: true/false, seChecked: true/false, drumsoloChecked: true/false, hasShortOption: true/false, hasSeOption: true/false, hasDrumsoloOption: true/false, rGt: "D", lGt: "D", bass: "D", bpm: "180", chorus: "あり" }
 */
function fillSlotWithItem(slotElement, songData) {
  console.log(`[fillSlotWithItem] Filling slot ${slotElement.dataset.slotIndex} with item ID: ${songData.itemId}`);
  console.log(`[fillSlotWithItem]   songData received:`, songData);

  const existingSongInfoContainer = slotElement.querySelector('.song-info-container');
  let songInfoContainer;
  if (existingSongInfoContainer) {
      songInfoContainer = existingSongInfoContainer;
      songInfoContainer.innerHTML = ''; // 既存の内容をクリア
  } else {
      songInfoContainer = document.createElement('div');
      songInfoContainer.classList.add('song-info-container');
      slotElement.appendChild(songInfoContainer);
  }

  const itemId = songData.itemId;
  const songName = songData.name;
  const albumClass = songData.albumClass;
  const isCurrentlyCheckedShort = songData.short;
  const isCurrentlyCheckedSe = songData.seChecked;
  const isCurrentlyCheckedDrumsolo = songData.drumsoloChecked;

  // 既存のアルバムクラスやドラッグ関連のクラスを削除
  Array.from(slotElement.classList).forEach(cls => {
    if (cls.startsWith('album') || cls === 'setlist-item' || cls === 'item' || cls === 'short' || cls === 'se-active' || cls === 'drumsolo-active') {
      slotElement.classList.remove(cls);
    }
  });

  const hasShortOption = songData.hasShortOption === true;
  const hasSeOption = songData.hasSeOption === true;
  const hasDrumsoloOption = songData.hasDrumsoloOption === true;

  // --- 曲名とオプション（Short/SE/ドラムソロ）部分 ---
  const songNameAndOptionDiv = document.createElement('div');
  songNameAndOptionDiv.classList.add('song-name-and-option');

  const songNameTextNode = document.createTextNode(songName);
  songNameAndOptionDiv.appendChild(songNameTextNode);

  if (hasShortOption) {
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedShort;
    checkbox.dataset.optionType = 'short';
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(Short)';
    label.classList.add('short-label');
    checkboxWrapper.appendChild(label);
    songNameAndOptionDiv.appendChild(checkboxWrapper);
  }

  if (hasSeOption) {
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedSe;
    checkbox.dataset.optionType = 'se';
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(SE有り)';
    label.classList.add('se-label');
    checkboxWrapper.appendChild(label);
    songNameAndOptionDiv.appendChild(checkboxWrapper);
  }

  if (hasDrumsoloOption) {
    const checkboxWrapper = document.createElement('span');
    checkboxWrapper.classList.add('checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCurrentlyCheckedDrumsolo;
    checkbox.dataset.optionType = 'drumsolo';
    checkboxWrapper.appendChild(checkbox);
    const label = document.createElement('span');
    label.textContent = '(ドラムソロ有り)';
    label.classList.add('drumsolo-label');
    checkboxWrapper.appendChild(label);
    songNameAndOptionDiv.appendChild(checkboxWrapper);
  }

  // --- チューニング、BPM、コーラス情報の表示 ---
  const additionalInfoDiv = document.createElement('div');
  additionalInfoDiv.classList.add('additional-song-info');

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

  if (infoParts.length > 0) {
      additionalInfoDiv.textContent = infoParts.join(' | ');
  } else {
      additionalInfoDiv.style.display = 'none';
  }

  songInfoContainer.appendChild(songNameAndOptionDiv);
  songInfoContainer.appendChild(additionalInfoDiv);

  slotElement.classList.toggle('short', isCurrentlyCheckedShort);
  slotElement.dataset.short = isCurrentlyCheckedShort ? 'true' : 'false';

  slotElement.classList.toggle('se-active', isCurrentlyCheckedSe);
  slotElement.dataset.seChecked = isCurrentlyCheckedSe ? 'true' : 'false';

  slotElement.classList.toggle('drumsolo-active', isCurrentlyCheckedDrumsolo);
  slotElement.dataset.drumsoloChecked = isCurrentlyCheckedDrumsolo ? 'true' : 'false';

  slotElement.classList.add('setlist-item', 'item');
  if (albumClass) {
    slotElement.classList.add(albumClass);
  }

  slotElement.dataset.itemId = itemId;
  slotElement.dataset.songName = songName;
  slotElement.dataset.isShortVersion = hasShortOption ? 'true' : 'false';
  slotElement.dataset.hasSeOption = hasSeOption ? 'true' : 'false';
  slotElement.dataset.hasDrumsoloOption = hasDrumsoloOption ? 'true' : 'false';

  slotElement.dataset.rGt = songData.rGt || '';
  slotElement.dataset.lGt = songData.lGt || '';
  slotElement.dataset.bass = songData.bass || '';
  slotElement.dataset.bpm = songData.bpm || '';
  slotElement.dataset.chorus = songData.chorus || '';

  // イベントリスナーの重複登録を防ぐため、一度削除してから再追加
  slotElement.removeEventListener("dragstart", handleDragStart);
  slotElement.removeEventListener("touchstart", handleTouchStart);
  slotElement.removeEventListener("touchmove", handleTouchMove);
  slotElement.removeEventListener("touchend", handleTouchEnd);
  slotElement.removeEventListener("touchcancel", handleTouchEnd);

  slotElement.draggable = true;
  slotElement.addEventListener("dragstart", handleDragStart);
  slotElement.addEventListener("touchstart", handleTouchStart, { passive: false });
  slotElement.addEventListener("touchmove", handleTouchMove, { passive: false });
  slotElement.addEventListener("touchend", handleTouchEnd);
  slotElement.addEventListener("touchcancel", handleTouchEnd);

  console.log(`[fillSlotWithItem] Slot ${slotElement.dataset.slotIndex} filled and events re-attached.`);
}


// =======================================================================================
// ドラッグ&ドロップイベントハンドラ (PC & モバイル)
// =======================================================================================

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
    originalSetlistSlot = null; // アルバムからのドラッグなので、元のセットリストスロットはなし
    currentPcDraggedElement = originalElement; // アルバムアイテム自体をPCドラッグ要素として保持
    console.log(`[dragstart:PC] Dragging from album. Original item ${originalElement.dataset.itemId} is the currentPcDraggedElement.`);
  }

  // ドラッグ元のアルバムリストを記録
  if (!originalAlbumMap.has(draggingItemId)) {
    const originalList = originalElement.parentNode;
    const originalListId = originalList ? originalList.id : null;
    originalAlbumMap.set(draggingItemId, originalListId);
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalListId} (newly set)`);
  } else {
    console.log(`[dragstart] itemId: ${draggingItemId}, originalListId: ${originalAlbumMap.get(draggingItemId)} (already known)`);
  }
  if (setlist.contains(originalElement)) {
      currentPcDraggedElement.classList.add("dragging"); // セットリスト内のアイテムにだけ 'dragging' クラスを追加
  }

  console.log(`[dragstart] dataTransfer set with: ${draggingItemId}`);
  console.log(`[dragstart] currentPcDraggedElement element:`, currentPcDraggedElement);
}

/**
 * ドラッグ要素がドロップターゲットに入った時の処理。
 * @param {Event} event - イベントオブジェクト
 */
function handleDragEnter(event) {
  event.preventDefault();
  // `currentPcDraggedElement` または `currentTouchDraggedClone` のどちらかが存在すれば、ドラッグ中とみなす
  const activeDraggingElement = currentPcDraggedElement || currentTouchDraggedClone;

  if (activeDraggingElement) {
    const targetSlot = event.target.closest('.setlist-slot');
    // ドラッグ元がセットリスト内の要素で、それが自分自身のスロットに戻った場合は何もしない
    if (originalSetlistSlot && targetSlot && targetSlot.dataset.slotIndex === originalSetlistSlot.dataset.slotIndex) {
      return;
    }
    if (targetSlot) {
      targetSlot.classList.add('drag-over');
      console.log(`[dragenter] Entered slot: ${targetSlot.dataset.slotIndex}`);
    }
  }
}

/**
 * ドラッグ退出時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragLeave(event) {
  const targetSlot = event.target.closest('.setlist-slot');
  // `event.relatedTarget` が現在の要素の外部に出たことを確認
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

/**
 * ドラッグオーバー時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
  event.preventDefault(); // これを一番最初に呼ぶことで、ドロップを許可する

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  const targetSlot = event.target.closest('.setlist-slot');
  const newDropZone = targetSlot;

  if (newDropZone) {
    // ドラッグ元がセットリスト内の要素で、それが自分自身のスロットに戻る場合はハイライトしない
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
    // ドロップゾーン外に出た場合
    currentDropZone.classList.remove('drag-over');
    currentDropZone = null;
  }
}

/**
 * ドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
  event.preventDefault();
  console.log("[handleDrop] Drop event fired (PC).");
  // PCドラッグの場合は dataTransfer から itemId を取得
  const droppedItemId = event.dataTransfer.getData("text/plain");
  console.log(`[handleDrop] droppedItemId from dataTransfer: "${droppedItemId}"`);

  // ドロップターゲットとなるスロットを取得
  const dropTargetSlot = event.target.closest('.setlist-slot');
  console.log("[handleDrop] dropTargetSlot:", dropTargetSlot);

  if (dropTargetSlot) {
    processDrop(droppedItemId, dropTargetSlot);
  } else {
    // セットリストスロット外にドロップされた場合
    console.warn("[handleDrop] Dropped outside a setlist slot. Attempting to restore to original list or remove.");
    if (originalSetlistSlot) {
        // 元々セットリストにいたアイテムを外にドロップした場合は、スロットをクリアし、アルバムに戻す
        clearSlotContent(parseInt(originalSetlistSlot.dataset.slotIndex, 10));
        restoreToOriginalList(currentPcDraggedElement || droppedItemId); // PCドラッグ元の要素またはitemIdで戻す
    } else {
        // アルバムからのアイテムをセットリスト外にドロップした場合は、アルバムアイテムを再表示
        restoreToOriginalList(currentPcDraggedElement || droppedItemId);
    }
  }
  finishDragging(); // ドラッグ操作のクリーンアップ
}

/**
 * モバイルデバイスでのタッチ開始処理。
 * 長押しとドラッグの開始を管理。
 * @param {TouchEvent} e - タッチイベントオブジェクト。
 */
function handleTouchStart(e) {
    if (e.touches.length > 1) {
        console.log("[touchstart:Mobile] Multiple touches detected. Ignoring for drag.");
        return;
    }

    const targetElement = e.target.closest('.item, .setlist-slot');
    if (!targetElement) {
        console.log("[touchstart:Mobile] Touched element is not a draggable item or setlist slot.");
        return;
    }

    // チェックボックスをクリックした場合はドラッグを無効化
    if (e.target.classList.contains('checkbox-wrapper') || e.target.type === 'checkbox') {
        console.log("[touchstart:Mobile] Touched checkbox/wrapper. Preventing drag.");
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        return;
    }

    // ドラッグ中の要素が既に存在する場合は何もしない (これにより新しいドラッグを阻止)
    if (isDragging) {
        console.log("[touchstart:Mobile] Already dragging. Ignoring new touch start.");
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        return;
    }

    activeTouchSlot = targetElement;
    startTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const itemId = targetElement.dataset.itemId;
    console.log(`[touchstart:Mobile] Touched element (non-checkbox):`, targetElement, `itemId: ${itemId}`);

    if (itemId) {
        draggingItemId = itemId;
        console.log(`[touchstart:Mobile] Set draggingItemId to: ${draggingItemId}`);
    } else {
        console.warn("[touchstart:Mobile] No itemId found on touched element. Cannot set draggingItemId.");
        return; // itemIdがない場合はドラッグを開始しない
    }

    const isAlbumItem = targetElement.closest('.album-content') && targetElement.classList.contains('item');
    const isSetlistItem = targetElement.classList.contains('setlist-item');
    const isEmptySetlistSlot = targetElement.classList.contains('setlist-slot') && !targetElement.classList.contains('setlist-item');

    if (isAlbumItem) {
        originalSetlistSlot = null;
        console.log("[touchstart:Mobile] Dragging from album list:", itemId);
    } else if (isSetlistItem) {
        originalSetlistSlot = targetElement;
        originalSetlistSlot._originalItemData = getSlotItemData(originalSetlistSlot);
        console.log("[touchstart:Mobile] Dragging from setlist slot:", itemId, "Original data saved:", originalSetlistSlot._originalItemData);
    } else if (isEmptySetlistSlot) {
        console.log("[touchstart:Mobile] Touched empty setlist slot. Not initiating drag.");
        // 空のスロットへのタッチでは長押しタイマーを設定しない
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        return;
    } else {
        console.warn("[touchstart:Mobile] Touched element is neither an album item nor a setlist slot. Aborting drag.");
        return;
    }

    // 既存のタイマーがあればクリア
    if (touchTimeout) {
        clearTimeout(touchTimeout);
    }

    // 長押し検出のためのタイマーを設定
    touchTimeout = setTimeout(() => {
        console.log("[touchstart:Mobile] Long press detected. Initiating drag for itemId:", draggingItemId);
        isDragging = true; // ドラッグ状態に設定

        // クローン要素を作成し、位置を初期化
        createTouchDraggedClone(targetElement, startTouchPos.x, startTouchPos.y, draggingItemId);

        // 元の要素を非表示にし、必要であればプレースホルダーを追加
        if (isAlbumItem) {
            targetElement.style.visibility = 'hidden';
            currentPcDraggedElement = targetElement; // PCドラッグと同様に参照を保持
        } else if (isSetlistItem) {
            targetElement.style.visibility = 'hidden';
            targetElement.classList.add('placeholder-slot');
            currentPcDraggedElement = targetElement; // PCドラッグと同様に参照を保持
        }

        e.preventDefault(); // 長押しでドラッグが開始されたら、デフォルトのスクロールなどを抑制
    }, LONG_PRESS_THRESHOLD);
}

/**
 * モバイルデバイスでのタッチ移動処理。
 * @param {TouchEvent} e - タッチイベントオブジェクト。
 */
function handleTouchMove(e) {
    if (touchTimeout) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = Math.abs(currentX - startTouchPos.x);
        const deltaY = Math.abs(currentY - startTouchPos.y);

        // 長押し閾値に達する前に移動閾値を超えたら、長押しをキャンセル
        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
            console.log("[touchmove] Moved beyond threshold before long press. Cancelling drag timeout. Allowing scroll.");
            return; // ドラッグを開始しないため、スクロールを許可
        }
    }

    // ドラッグ中の場合のみ、クローン要素の位置を更新し、デフォルトの動作を抑制
    if (isDragging) {
        e.preventDefault(); // これがスクロールを抑制する主な役割
        updateTouchDraggedClonePosition(e);

        const targetElement = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);

        // handleDragOver を呼び出すためのダミーイベントオブジェクト
        const dummyEvent = {
            preventDefault: () => {},
            dataTransfer: { dropEffect: 'move' },
            target: targetElement
        };
        handleDragOver(dummyEvent);
    }
}

/**
 * タッチ終了時の処理 (モバイル用)
 * @param {TouchEvent} e - タッチイベントオブジェクト。
 */
function handleTouchEnd(e) {
    console.log("[touchend] Touch end detected.");

    // 長押しタイマーがまだ残っていればクリア（ドラッグに発展しなかった単なるタップの場合）
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        console.log("[touchend] Cleared touchTimeout (no drag).");
    }

    // ドラッグ中でなければ、処理を終了（単なるタップの場合）
    if (!isDragging) {
        console.log("[touchend] Not in dragging state. Allowing default behaviors for non-drag.");
        return;
    }

    e.preventDefault(); // ドラッグ終了時はデフォルトの動作をキャンセル（スクロールなど）

    console.log("[touchend] Dragging was in progress. Attempting to finalize drop or revert.");

    // ドロップ処理を実行
    if (currentDropZone) {
        console.log(`[touchend] Valid drop zone found: ${currentDropZone.id || currentDropZone.dataset.slotIndex}. Proceeding with processDrop.`);
        // モバイルドラッグの場合、draggingItemIdは既に設定されている
        processDrop(draggingItemId, currentDropZone);
    } else {
        console.log("[touchend] No valid drop zone was found. Reverting drag.");
        // ドロップ失敗時はクリーンアップして元の状態に戻す
        finishDragging();
    }
}

/**
 * クローン要素作成（スマホ向けドラッグ開始時）
 * @param {Element} originalElement - 元の要素 (album item or setlist slot item)
 * @param {number} initialX - タッチ開始時のX座標
 * @param {number} initialY - タッチ開始時のY座標
 * @param {string} itemIdToClone - クローンするアイテムのID
 */
function createTouchDraggedClone(originalElement, initialX, initialY, itemIdToClone) {
    // 既存のクローンがあれば削除
    if (currentTouchDraggedClone) {
        currentTouchDraggedClone.remove();
        currentTouchDraggedClone = null;
    }

    if (!originalElement || !document.body.contains(originalElement)) {
        console.warn("[createTouchDraggedClone] Original element not valid or not in body.");
        return;
    }

    // 元の要素をクローン
    currentTouchDraggedClone = originalElement.cloneNode(true);
    currentTouchDraggedClone.classList.add("dragging", "touch-dragging-clone");
    currentTouchDraggedClone.style.display = 'block';

    // 元の要素のデータ属性とクラスをクローンにコピー
    // `fillSlotWithItem` が内部で設定する `dataset` やクラスを考慮
    // `getSlotItemData` を使って取得したデータでクローンを再構築すると確実
    const clonedData = getSlotItemData(originalElement);
    if (clonedData) {
        // `fillSlotWithItem` を使ってクローンを初期化
        // ただし、fillSlotWithItem はスロットに特化しているので、クローン用に調整
        // クローンは `slotElement` ではないため、直接スタイルとデータ属性を設定
        currentTouchDraggedClone.innerHTML = ''; // クローンの内容を一旦クリア
        const songInfoContainer = document.createElement('div');
        songInfoContainer.classList.add('song-info-container');
        currentTouchDraggedClone.appendChild(songInfoContainer);

        const songNameAndOptionDiv = document.createElement('div');
        songNameAndOptionDiv.classList.add('song-name-and-option');
        songNameAndOptionDiv.appendChild(document.createTextNode(clonedData.name));

        if (clonedData.hasShortOption) {
            const wrapper = document.createElement('span'); wrapper.classList.add('checkbox-wrapper');
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = clonedData.short; chk.dataset.optionType = 'short';
            const lbl = document.createElement('span'); lbl.textContent = '(Short)'; lbl.classList.add('short-label');
            wrapper.append(chk, lbl); songNameAndOptionDiv.appendChild(wrapper);
        }
        if (clonedData.hasSeOption) {
            const wrapper = document.createElement('span'); wrapper.classList.add('checkbox-wrapper');
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = clonedData.seChecked; chk.dataset.optionType = 'se';
            const lbl = document.createElement('span'); lbl.textContent = '(SE有り)'; lbl.classList.add('se-label');
            wrapper.append(chk, lbl); songNameAndOptionDiv.appendChild(wrapper);
        }
        if (clonedData.hasDrumsoloOption) {
            const wrapper = document.createElement('span'); wrapper.classList.add('checkbox-wrapper');
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = clonedData.drumsoloChecked; chk.dataset.optionType = 'drumsolo';
            const lbl = document.createElement('span'); lbl.textContent = '(ドラムソロ有り)'; lbl.classList.add('drumsolo-label');
            wrapper.append(chk, lbl); songNameAndOptionDiv.appendChild(wrapper);
        }

        const additionalInfoDiv = document.createElement('div');
        additionalInfoDiv.classList.add('additional-song-info');
        const infoParts = [];
        if (clonedData.rGt || clonedData.lGt || clonedData.bass) infoParts.push(`A.Gt（${clonedData.rGt||''}） K.Gt（${clonedData.lGt||''}） B（${clonedData.bass||''}）`);
        if (clonedData.bpm) infoParts.push(`BPM:${clonedData.bpm}`);
        if (clonedData.chorus) infoParts.push(`コーラス:${clonedData.chorus}`);
        if (infoParts.length > 0) additionalInfoDiv.textContent = infoParts.join(' | '); else additionalInfoDiv.style.display = 'none';

        songInfoContainer.append(songNameAndOptionDiv, additionalInfoDiv);

        // クラスとデータ属性を直接設定
        currentTouchDraggedClone.classList.add('setlist-item', 'item'); // 基本クラス
        if (clonedData.albumClass) currentTouchDraggedClone.classList.add(clonedData.albumClass);
        if (clonedData.short) currentTouchDraggedClone.classList.add('short');
        if (clonedData.seChecked) currentTouchDraggedClone.classList.add('se-active');
        if (clonedData.drumsoloChecked) currentTouchDraggedClone.classList.add('drumsolo-active');

        currentTouchDraggedClone.dataset.itemId = clonedData.itemId;
        currentTouchDraggedClone.dataset.songName = clonedData.name;
        currentTouchDraggedClone.dataset.short = clonedData.short ? 'true' : 'false';
        currentTouchDraggedClone.dataset.seChecked = clonedData.seChecked ? 'true' : 'false';
        currentTouchDraggedClone.dataset.drumsoloChecked = clonedData.drumsoloChecked ? 'true' : 'false';
        currentTouchDraggedClone.dataset.isShortVersion = clonedData.hasShortOption ? 'true' : 'false';
        currentTouchDraggedClone.dataset.hasSeOption = clonedData.hasSeOption ? 'true' : 'false';
        currentTouchDraggedClone.dataset.hasDrumsoloOption = clonedData.hasDrumsoloOption ? 'true' : 'false';
        currentTouchDraggedClone.dataset.rGt = clonedData.rGt;
        currentTouchDraggedClone.dataset.lGt = clonedData.lGt;
        currentTouchDraggedClone.dataset.bass = clonedData.bass;
        currentTouchDraggedClone.dataset.bpm = clonedData.bpm;
        currentTouchDraggedClone.dataset.chorus = clonedData.chorus;

    } else {
        console.warn("[createTouchDraggedClone] Could not get valid data for cloning original element:", originalElement);
        originalElement.style.visibility = ''; // 元の要素を表示に戻してエラー状態を回避
        return; // クローン作成を中止
    }

    document.body.appendChild(currentTouchDraggedClone);

    // 元の要素の状態変更
    if (setlist.contains(originalElement) && originalElement.classList.contains('setlist-item')) {
        originalSetlistSlot = originalElement;
        originalSetlistSlot.classList.add('placeholder-slot');
        originalElement.style.visibility = 'hidden';
        console.log(`[createTouchDraggedClone] Original setlist slot ${originalSetlistSlot.dataset.slotIndex} marked as placeholder and hidden.`);
    } else { // アルバムリストからのアイテム
        originalElement.style.visibility = 'hidden';
        originalSetlistSlot = null; // アルバムからのドラッグなのでスロットはnull
        currentPcDraggedElement = originalElement; // モバイルでもアルバムアイテムの参照を保持
        console.log(`[createTouchDraggedClone] Original album item ${originalElement.dataset.itemId} hidden.`);
    }

    // 元のリストの記録（重複して記録しないようにチェック）
    if (!originalAlbumMap.has(itemIdToClone)) {
        const originalList = originalElement.parentNode;
        const originalListId = originalList ? originalList.id : null;
        originalAlbumMap.set(itemIdToClone, originalListId);
        console.log(`[createTouchDraggedClone] Original list ID "${originalListId}" for item ${itemIdToClone} recorded.`);
    }

    // クローンの初期位置調整
    currentTouchDraggedClone.style.position = 'fixed';
    currentTouchDraggedClone.style.zIndex = '10000';
    currentTouchDraggedClone.style.width = originalElement.offsetWidth + 'px';
    currentTouchDraggedClone.style.height = originalElement.offsetHeight + 'px';
    currentTouchDraggedClone.style.left = initialX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
    currentTouchDraggedClone.style.top = initialY - currentTouchDraggedClone.offsetHeight / 2 + 'px';
    currentTouchDraggedClone.style.pointerEvents = 'none'; // クローン自体はイベントを受け取らない

    console.log(`[createTouchDraggedClone] clone created for itemId=${itemIdToClone}`);
}

/**
 * モバイルドラッグ中のクローン要素の位置を更新する（requestAnimationFrame用）
 * @param {TouchEvent} e タッチイベント
 */
function updateTouchDraggedClonePosition(e) {
    if (!isDragging || !currentTouchDraggedClone || !e.touches || e.touches.length === 0) {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        return;
    }

    const touch = e.touches[0];
    currentTouchDraggedClone.style.left = touch.clientX - currentTouchDraggedClone.offsetWidth / 2 + 'px';
    currentTouchDraggedClone.style.top = touch.clientY - currentTouchDraggedClone.offsetHeight / 2 + 'px';

    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => updateTouchDraggedClonePosition(e));
}

/**
 * ドラッグ終了時のクリーンアップと状態リセット
 */
function finishDragging() {
  console.log("[finishDragging] Initiating drag operation finalization.");

  // PCドラッグで元の要素を非表示にしていた場合、表示に戻す
  if (currentPcDraggedElement) {
      if (setlist.contains(currentPcDraggedElement)) {
          currentPcDraggedElement.classList.remove("dragging", "placeholder-slot");
      } else { // アルバムアイテムの場合
          currentPcDraggedElement.classList.remove("dragging");
          if (currentPcDraggedElement.style.visibility === 'hidden') {
              currentPcDraggedElement.style.visibility = '';
              console.log(`[finishDragging] Restored visibility for PC dragged album item: ${currentPcDraggedElement.dataset.itemId || 'N/A'}`);
          }
      }
      currentPcDraggedElement = null;
  }

  // モバイルドラッグ用のクローンがあれば削除
  if (currentTouchDraggedClone && currentTouchDraggedClone.parentNode === document.body) {
    currentTouchDraggedClone.remove();
    console.log("[finishDragging] Removed remaining currentTouchDraggedClone (mobile clone) from body.");
  }
  currentTouchDraggedClone = null;

  // セットリストからドラッグ開始した場合、元のスロットのプレースホルダーを解除し、必要ならデータを戻す
  if (originalSetlistSlot) {
      originalSetlistSlot.classList.remove('placeholder-slot');
      console.log(`[finishDragging] Removed 'placeholder-slot' class for originalSetlistSlot: ${originalSetlistSlot.dataset.slotIndex}.`);

      if (originalSetlistSlot.style.visibility === 'hidden') {
          originalSetlistSlot.style.visibility = '';
          console.log(`[finishDragging] Ensured originalSetlistSlot ${originalSetlistSlot.dataset.slotIndex} visibility is restored.`);
      }

      // ドラッグが元のスロットに戻されず、かつスロットが空になっている場合
      if (originalSetlistSlot._originalItemData && !originalSetlistSlot.dataset.itemId) {
          console.log(`[finishDragging] Drag failed or returned to original slot, and original slot is empty. Restoring original item to slot ${originalSetlistSlot.dataset.slotIndex}.`);
          fillSlotWithItem(originalSetlistSlot, originalSetlistSlot._originalItemData);
      }
      //_originalItemDataのクリア
      delete originalSetlistSlot._originalItemData;
      console.log(`[finishDragging] Cleared _originalItemData for slot ${originalSetlistSlot.dataset.slotIndex}.`);
  }

  // 全てのドロップゾーンのハイライトを解除
  document.querySelectorAll('.setlist-slot').forEach(slot => {
    slot.classList.remove('drag-over', 'active-drop-target');
    slot.style.opacity = '';
  });
  console.log("[finishDragging] Removed drag-related classes from all setlist slots.");

  // グローバル変数のリセット
  currentDropZone = null;
  activeTouchSlot = null;
  draggingItemId = null;
  isDragging = false;
  originalSetlistSlot = null;

  // タイマーやアニメーションフレームのクリア
  if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
  }
  if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
  }

  // メニュー内のアルバムアイテムの表示状態を更新（セットリストにあるアイテムは非表示にする）
  hideSetlistItemsInMenu();

  console.log("[finishDragging] Drag operation finalized. All global drag states reset.");
}

/**
 * ドロップされたアイテムの処理 (PC & モバイル共通)
 * @param {string} droppedItemId - ドロップされたアイテムのID
 * @param {HTMLElement} dropZone - ドロップされたターゲット要素（セットリストのスロット）
 */
function processDrop(droppedItemId, dropZone) {
    console.log(`[processDrop] Dropping item ID: ${droppedItemId} onto`, dropZone);

    if (!droppedItemId) {
        console.warn("[processDrop] No droppedItemId found. Aborting drop.");
        return;
    }

    const targetSlotIndex = dropZone.dataset.slotIndex ? parseInt(dropZone.dataset.slotIndex, 10) : -1;
    if (targetSlotIndex === -1) {
        console.error("[processDrop] Invalid drop zone or slot index.");
        return;
    }

    // ドラッグされたアイテムのデータを取得
    let draggedItemData;
    if (originalSetlistSlot && originalSetlistSlot._originalItemData) {
        // セットリスト内での移動の場合、_originalItemData を使用
        draggedItemData = originalSetlistSlot._originalItemData;
        console.log("[processDrop] Retrieved dragged item data from originalSetlistSlot:", draggedItemData);
    } else {
        // アルバムからのドラッグの場合、albumItemsData またはダミーデータから取得
        draggedItemData = albumItemsData.find(item => item.itemId === droppedItemId) || getAlbumItemData(droppedItemId);
        if (draggedItemData) {
            draggedItemData = { ...draggedItemData }; // 変更に備えてコピーを作成
            console.log("[processDrop] Retrieved dragged item data from album items:", draggedItemData);
        } else {
            console.error(`[processDrop] Critical: dragged item data not found for ID: ${droppedItemId}.`);
            return;
        }
    }

    // ドロップ先のスロットが既に埋まっているかを確認
    const targetSlotHasItem = dropZone.classList.contains('setlist-item');
    const targetSlotCurrentItemData = targetSlotHasItem ? getSlotItemData(dropZone) : null;

    if (originalSetlistSlot === null) {
        // アルバムリストからセットリストへドラッグされた場合
        if (targetSlotHasItem) {
            // ターゲットスロットにアイテムが存在する場合 (スワップ)
            console.log(`[processDrop] Swapping album item ${droppedItemId} with existing item in slot ${targetSlotIndex}.`);
            if (targetSlotCurrentItemData) {
                // ドロップ先の既存アイテムをアルバムリストに表示し直す
                restoreToOriginalList(targetSlotCurrentItemData);
            }
            draggedItemData.slotIndex = targetSlotIndex;
            fillSlotWithItem(dropZone, draggedItemData);
            // 元のアルバムアイテムを非表示にする
            const albumItemToHide = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (albumItemToHide) albumItemToHide.style.visibility = 'hidden';
            showMessageBox('アイテムを入れ替えました。');
        } else {
            // ターゲットスロットが空の場合 (追加)
            console.log(`[processDrop] Adding album item ${droppedItemId} to empty slot ${targetSlotIndex}.`);
            draggedItemData.slotIndex = targetSlotIndex;
            fillSlotWithItem(dropZone, draggedItemData);
            // 元のアルバムアイテムを非表示にする
            const albumItemToHide = document.querySelector(`.album-content .item[data-item-id="${droppedItemId}"]`);
            if (albumItemToHide) albumItemToHide.style.visibility = 'hidden';
            showMessageBox(`${draggedItemData.name} を追加しました`);
        }
    } else {
        // セットリスト内でアイテムが移動またはスワップされた場合
        const originalSlotIndex = parseInt(originalSetlistSlot.dataset.slotIndex, 10);
        console.log(`[processDrop] Moving/Swapping setlist item from slot ${originalSlotIndex} to slot ${targetSlotIndex}.`);

        if (originalSlotIndex === targetSlotIndex) {
            console.log(`[processDrop] Item ${droppedItemId} dropped back into its original slot ${originalSlotIndex}. No change.`);
            showMessageBox('元の位置に戻しました。');
            // 元のスロットが既に `_originalItemData` で埋められているので何もしない
        } else {
            if (targetSlotHasItem) {
                // ターゲットスロットにアイテムが存在する場合 (スワップ)
                console.log(`[processDrop] Swapping item from ${originalSlotIndex} with item in ${targetSlotIndex}.`);
                const originalItemData = originalSetlistSlot._originalItemData;
                const targetItemData = getSlotItemData(dropZone);

                originalItemData.slotIndex = targetSlotIndex;
                fillSlotWithItem(dropZone, originalItemData);

                if (targetItemData) {
                    targetItemData.slotIndex = originalSlotIndex;
                    fillSlotWithItem(originalSetlistSlot, targetItemData);
                } else {
                    // ここは通常発生しないはずだが、念のため
                    clearSlotContent(originalSlotIndex);
                }
                showMessageBox('アイテムを入れ替えました。');
            } else {
                // ターゲットスロットが空の場合 (移動)
                console.log(`[processDrop] Moving item from ${originalSlotIndex} to empty slot ${targetSlotIndex}.`);
                const originalItemData = originalSetlistSlot._originalItemData;

                originalItemData.slotIndex = targetSlotIndex;
                fillSlotWithItem(dropZone, originalItemData);

                clearSlotContent(originalSlotIndex);
                showMessageBox('アイテムを移動しました。');
            }
        }
    }
}

// =======================================================================================
// ダブルクリックハンドラ
// =======================================================================================

/**
 * 指定されたアイテムをセットリストの指定されたスロットに追加する。
 * @param {string} itemId 追加するアイテムのID
 * @param {number} slotIndex 追加するスロットのインデックス
 * @returns {boolean} 追加が成功した場合は true, 失敗した場合は false
 */
function addItemToSetlist(itemId, targetSlotIndex) {
    const targetSlot = document.querySelector(`.setlist-slot[data-slot-index="${targetSlotIndex}"]`);
    if (targetSlot) {
        const sourceItem = document.querySelector(`.album-content .item[data-item-id="${itemId}"]`);
        if (sourceItem) {
            const itemData = getSlotItemData(sourceItem);
            itemData.slotIndex = targetSlotIndex; // 移動先のスロットインデックスを設定
            fillSlotWithItem(targetSlot, itemData);
            hideSetlistItemsInMenu(); // メニュー内の表示状態を更新
            showMessageBox(`${itemData.name} を追加しました`);
            return true;
        }
    }
    return false;
}

/**
 * ダブルクリック時の処理。
 * アルバムアイテムからの追加、またはセットリストアイテムからの削除を行う。
 * @param {MouseEvent} e - ダブルクリックイベント
 */
function handleDoubleClick(e) {
    e.stopPropagation(); // 親要素へのクリックイベント伝播を停止
    console.log("[handleDoubleClick] Double click detected on element:", e.target.closest('.item, .setlist-slot'));

    const itemElement = e.target.closest('.item, .setlist-slot');
    if (!itemElement) {
        console.log("[handleDoubleClick] No item element found.");
        return;
    }

    const itemId = itemElement.dataset.itemId;
    console.log("[handleDoubleClick] Double click on item ID:", itemId);

    // ダブルクリックされた要素がアルバムリストにある場合
    if (itemElement.closest('.album-content') && itemElement.classList.contains('item')) {
        console.log("[handleDoubleClick] Item is in album list. Attempting to add to setlist.");
        const nextEmptySlotIndex = findNextEmptySetlistSlot();
        if (nextEmptySlotIndex !== -1) {
            addItemToSetlist(itemId, nextEmptySlotIndex);
            itemElement.style.visibility = 'hidden'; // アルバムメニューから非表示
            console.log("[handleDoubleClick] Hiding original album item:", itemId);
        } else {
            showMessageBox("セットリストに空きがありません。");
        }
    }
    // ダブルクリックされた要素がセットリストにある場合
    else if (itemElement.closest('.setlist-items') && itemElement.classList.contains('setlist-item')) {
        console.log("[handleDoubleClick] Item " + itemId + " is in setlist. Attempting to remove from setlist.");
        const slotIndex = parseInt(itemElement.dataset.slotIndex, 10);

        if (clearSlotContent(slotIndex)) {
            restoreToOriginalList(itemElement); // アルバムメニューに再表示
            hideSetlistItemsInMenu(); // メニュー表示状態を更新
            showMessageBox(`${itemElement.dataset.songName} をセットリストから削除しました`);
        }
    } else {
        console.log("[handleDoubleClick] No specific action defined for double click on this element.");
    }

    finishDragging(); // ダブルクリック後にドラッグ状態が残るのを防ぐ
}


// =======================================================================================
// セットリスト共有・PDF生成
// =======================================================================================

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
  const setlistRef = database.ref('setlists').push(); // 新しい参照を生成

  setlistRef.set(currentState)
    .then(() => {
        const shareId = setlistRef.key;
        const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

        const setlistItems = document.querySelectorAll("#setlist .setlist-slot.setlist-item");
        let songListText = "";
        let itemNo = 1;

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
                if (songData.drumsoloChecked) {
                    titleText += ' (ドラムソロ有り)';
                }

                const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                let line = '';
                if (isAlbum1) {
                    line = `    ${titleText}`; // インデント
                } else {
                    line = `${itemNo}. ${titleText}`;
                    itemNo++;
                }
                return line;
            }).join("\n");
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
 * セットリストのPDFを生成し、共有またはダウンロードする。
 * jsPDF-AutoTableを使用する。
 */
async function generateSetlistPdf() {
    showMessageBox("PDFを生成中...");
    console.log("[generateSetlistPdf] PDF generation started.");

    const setlistYear = document.getElementById('setlistYear')?.value;
    const setlistMonth = document.getElementById('setlistMonth')?.value;
    const setlistDay = document.getElementById('setlistDay')?.value;
    const setlistVenue = document.getElementById('setlistVenue')?.value;

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
    const simplePdfBody = [];
    const setlistSlots = document.querySelectorAll("#setlist .setlist-slot");

    let currentItemNoDetailed = 1;
    let currentItemNoSimple = 1;

    const album1ItemIds = ['album1-001', 'album1-002', 'album1-004', 'album1-005', 'album1-006', 'album1-007', 'album1-008', 'album1-009', 'album1-0010', 'album1-0011', 'album1-0012', 'album1-013'];

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

                const isAlbum1 = slot.dataset.itemId && album1ItemIds.includes(slot.dataset.itemId);

                // 詳細PDF用の行
                let detailedItemNo = '';
                if (!isAlbum1) {
                    detailedItemNo = currentItemNoDetailed.toString();
                    currentItemNoDetailed++;
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

                // シンプルPDF用の行
                if (isAlbum1) {
                    simplePdfBody.push(`    ${titleText}`);
                } else {
                    simplePdfBody.push(`${currentItemNoSimple}. ${titleText}`);
                    currentItemNoSimple++;
                }
            }
        } else if (slot.classList.contains('setlist-slot-text')) {
            const textContent = slot.textContent.trim();
            if (textContent) {
                tableBody.push([textContent, '', '', '', '', '', '']);
                simplePdfBody.push(textContent);
            }
        }
    }

    try {
        const { jsPDF } = window.jspdf;

        // --- 1. 詳細なセットリストPDFの生成 ---
        const detailedPdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(detailedPdf);

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

        await new Promise(resolve => setTimeout(resolve, 500)); // 少し待つ

        // --- 2. シンプルなセットリストPDFの生成 ---
        const simplePdf = new jsPDF('p', 'mm', 'a4');
        registerJapaneseFont(simplePdf);

        simplePdf.setFont('NotoSansJP', 'bold');

        const simpleFontSize = 28;
        simplePdf.setFontSize(simpleFontSize);

        const simpleTopMargin = 30;
        let simpleYPos = simpleTopMargin;

        const simpleLeftMargin = 25;

        if (headerText) {
            simplePdf.setFontSize(simpleFontSize + 8);
            simplePdf.text(headerText, simpleLeftMargin, simpleYPos);
            simpleYPos += (simpleFontSize + 8) * 1.5; // ヘッダーの高さに基づく余白
            simplePdf.setFontSize(simpleFontSize);
        }

        simplePdfBody.forEach(line => {
            simplePdf.text(line, simpleLeftMargin, simpleYPos);
            simpleYPos += simpleFontSize * 1.25;

            const bottomMarginThreshold = simpleFontSize + 10;
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


// =======================================================================================
// Firebaseから状態をロード (初期ロードおよび共有リンクからのロード)
// =======================================================================================

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

            // まずセットリストとアルバムアイテムを初期状態に戻す
            for (let i = 0; i < maxSongs; i++) {
              clearSlotContent(i);
            }
            document.querySelectorAll('.album-content .item').forEach(item => {
                item.style.visibility = ''; // すべてのアルバムアイテムを表示状態に戻す
            });
            originalAlbumMap.clear();
            console.log("[loadSetlistState] Setlist cleared, album items reset, and originalAlbumMap reset.");

            // originalAlbumMap を復元
            if (state.originalAlbumMap) {
              for (const key in state.originalAlbumMap) {
                originalAlbumMap.set(key, state.originalAlbumMap[key]);
              }
              console.log("[loadSetlistState] originalAlbumMap restored:", originalAlbumMap);
            }

            // 日付と会場を復元
            const setlistYear = document.getElementById('setlistYear');
            const setlistMonth = document.getElementById('setlistMonth');
            const setlistDay = document.getElementById('setlistDay');
            const setlistVenue = document.getElementById('setlistVenue');

            if (state.setlistDate && setlistYear && setlistMonth && setlistDay) {
                const dateParts = state.setlistDate.split('-');
                if (dateParts.length === 3) {
                    setlistYear.value = dateParts[0];
                    setlistMonth.value = dateParts[1];
                    updateDays(); // 月が変わったので日を更新
                    setlistDay.value = dateParts[2];
                    console.log(`[loadSetlistState] Restored date: ${state.setlistDate}`);
                } else {
                    console.warn("[loadSetlistState] Invalid date format for restoring:", state.setlistDate);
                }
            } else {
                console.log("[loadSetlistState] No date to restore or date select elements not found.");
                // 共有IDがあっても日付が保存されていない場合は今日の日付を設定
                const today = new Date();
                if (setlistYear) setlistYear.value = today.getFullYear();
                if (setlistMonth) setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
                updateDays();
                if (setlistDay) setlistDay.value = today.getDate().toString().padStart(2, '0');
            }
            if (setlistVenue) {
                setlistVenue.value = state.setlistVenue || '';
                console.log(`[loadSetlistState] Restored venue: ${state.setlistVenue || 'N/A'}`);
            } else {
                console.warn("[loadSetlistState] Venue input element not found.");
            }

            // セットリストアイテムを復元
            state.setlist.forEach(itemData => {
              const targetSlot = setlist.querySelector(`.setlist-slot[data-slot-index="${itemData.slotIndex}"]`);
              if (targetSlot) {
                  console.log(`[loadSetlistState] Filling slot ${itemData.slotIndex} with item ID: ${itemData.itemId}`);
                  fillSlotWithItem(targetSlot, itemData);

                  // セットリストにロードされたアイテムはアルバムメニューで非表示にする
                  const albumItemInMenu = document.querySelector(`.album-content .item[data-item-id="${itemData.itemId}"]`);
                  if (albumItemInMenu) {
                      albumItemInMenu.style.visibility = 'hidden';
                      console.log(`[loadSetlistState] Hid album item in menu: ${itemData.itemId}`);
                  }
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
              document.querySelectorAll('.album-content').forEach(album => album.classList.remove('active')); // 全て閉じてから開く
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
            resolve(); // 状態が見つからなくても、ロード処理は完了として解決する
          }
        })
        .catch((error) => {
          console.error('[loadSetlistState] セットリストのロードに失敗しました:', error);
          showMessageBox('セットリストのロードに失敗しました。');
          reject(error);
        });
    } else {
      console.log("[loadSetlistState] No shareId found in URL. Loading default date state.");
      const setlistYear = document.getElementById('setlistYear');
      const setlistMonth = document.getElementById('setlistMonth');
      const setlistDay = document.getElementById('setlistDay');
      if (setlistYear && setlistMonth && setlistDay) {
          const today = new Date();
          setlistYear.value = today.getFullYear();
          setlistMonth.value = (today.getMonth() + 1).toString().padStart(2, '0');
          updateDays(); // 日を正確に設定するために呼ぶ
          setlistDay.value = today.getDate().toString().padStart(2, '0');
          console.log(`[loadSetlistState] Initialized date to today: ${setlistYear.value}-${setlistMonth.value}-${setlistDay.value}`);
      }
      resolve(); // shareId がなくてもロード処理は完了
    }
  });
}

// =======================================================================================
// イベントリスナーの登録 (DOMContentLoaded 内で実行)
// =======================================================================================

/**
 * ドラッグ＆ドロップ関連のイベントリスナーを要素に設定する。
 * @param {Element} element - イベントリスナーを設定する対象の要素
 */
function enableDragAndDrop(element) {
    if (element.classList.contains('item')) {
        // アルバムアイテムの場合、dragstart と touchイベントを設定
        if (!element.dataset.itemId) { // itemIdがなければ生成（初回読み込み時など）
            element.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
        if (!element.dataset.songName) { // songNameがなければtextContentから取得
            element.dataset.songName = element.textContent.trim();
        }
        element.draggable = true;
        element.addEventListener("dragstart", handleDragStart);
        element.addEventListener("touchstart", handleTouchStart, { passive: false });
        element.addEventListener("touchmove", handleTouchMove, { passive: false });
        element.addEventListener("touchend", handleTouchEnd);
        element.addEventListener("touchcancel", handleTouchEnd);
    } else if (element.classList.contains('setlist-slot')) {
        // セットリストスロットの場合、drop target イベントを設定
        element.addEventListener("dragover", handleDragOver);
        element.addEventListener("drop", handleDrop);
        element.addEventListener("dragenter", handleDragEnter);
        element.addEventListener("dragleave", handleDragLeave);
    }
}

// Global dragend listener (個々の要素ではなく、ドキュメント全体で監視)
document.addEventListener("dragend", finishDragging);


// =======================================================================================
// 初期化 (DOMContentLoaded イベント)
// =======================================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] Page loaded. Initializing application.");

    // --- ドラッグ＆ドロップ関連の初期設定 ---
    // アルバムアイテムにドラッグ＆ドロップイベントを設定
    document.querySelectorAll(".album-content .item").forEach((item) => {
      enableDragAndDrop(item);
      console.log(`[DOMContentLoaded] Enabled drag and drop for album item: ${item.dataset.itemId}`);
    });

    // セットリストのスロットにドロップターゲットとしてのイベントを設定
    setlist.querySelectorAll(".setlist-slot").forEach((slot, index) => {
      if (!slot.dataset.slotIndex) { // slotIndexが設定されていなければ設定
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
              const slotElement = e.currentTarget; // イベントリスナーを付けたスロット要素自身

              if (optionType === 'short') {
                  slotElement.classList.toggle('short', checkbox.checked);
                  slotElement.dataset.short = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slotElement.dataset.slotIndex} short status changed to: ${checkbox.checked}`);
              } else if (optionType === 'se') {
                  slotElement.classList.toggle('se-active', checkbox.checked);
                  slotElement.dataset.seChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slotElement.dataset.slotIndex} SE status changed to: ${checkbox.checked}`);
              } else if (optionType === 'drumsolo') {
                  slotElement.classList.toggle('drumsolo-active', checkbox.checked);
                  slotElement.dataset.drumsoloChecked = checkbox.checked ? 'true' : 'false';
                  console.log(`[slotClick] Slot ${slotElement.dataset.slotIndex} drumsolo status changed to: ${checkbox.checked}`);
              }

              // チェックボックス操作でドラッグやダブルタップの誤判定を防ぐ
              lastTapTime = 0;
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

    // 年のドロップダウンを生成 (現在の年から過去30年、未来5年)
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

    // --- モーダル関連の初期設定 ---
    const openPastSetlistsModalButton = document.getElementById('openPastSetlistsModal');
    const pastSetlistsModal = document.getElementById('pastSetlistsModal');
    const closePastSetlistsModalButton = document.getElementById('closePastSetlistsModalButton');

    const open2025FromPastModalButton = document.getElementById('open2025FromPastModalButton');
    const year2025DetailModal = document.getElementById('year2025DetailModal');
    const close2025DetailModalButton = document.getElementById('close2025DetailModalButton');

    // 「過去セットリスト」モーダルの開閉
    if (openPastSetlistsModalButton && pastSetlistsModal && closePastSetlistsModalButton) {
        openPastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.add('active');
            console.log("[Modal] 'Past Setlists' Modal Opened.");
        });
        closePastSetlistsModalButton.addEventListener('click', () => {
            pastSetlistsModal.classList.remove('active');
            console.log("[Modal] 'Past Setlists' Modal Closed by button.");
        });
        pastSetlistsModal.addEventListener('click', (event) => {
            if (event.target === pastSetlistsModal) { // オーバーレイクリック
                pastSetlistsModal.classList.remove('active');
                console.log("[Modal] 'Past Setlists' Modal Closed by overlay click.");
            }
        });
    } else {
        console.warn("[Modal Init] One or more elements for 'Past Setlists' modal not found.");
    }

    // 2025年セットリスト詳細モーダルの開閉
    if (year2025DetailModal && close2025DetailModalButton) {
        if (open2025FromPastModalButton) { // 「過去セットリスト」モーダルからの遷移ボタン
            open2025FromPastModalButton.addEventListener('click', () => {
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active'); // 親モーダルを閉じる
                year2025DetailModal.classList.add('active');
                console.log("[Modal] 2025 Detail Modal Opened from 'Past Setlists' modal.");
            });
        }
        close2025DetailModalButton.addEventListener('click', () => {
            year2025DetailModal.classList.remove('active');
            console.log("[Modal] 2025 Detail Modal Closed by button.");
        });
        year2025DetailModal.addEventListener('click', (event) => {
            if (event.target === year2025DetailModal) { // オーバーレイクリック
                year2025DetailModal.classList.remove('active');
                console.log("[Modal] 2025 Detail Modal Closed by overlay click.");
            }
        });
    } else {
        console.warn("[Modal Init] One or more elements for 2025 detail modal not fully found.");
    }

    // --- モーダル内の setlist-link のクリックハンドラ ---
    document.querySelectorAll('.setlist-link').forEach(link => {
        link.addEventListener('click', (event) => {
            const shareIdMatch = link.href.match(/\?shareId=([^&]+)/);
            if (shareIdMatch) {
                event.preventDefault(); // デフォルトの遷移を防ぐ
                const shareId = shareIdMatch[1];
                const newUrl = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;

                window.history.pushState({ path: newUrl }, '', newUrl); // URLを更新

                loadSetlistState().then(() => {
                    console.log(`[setlist-link click] Setlist loaded from shareId: ${shareId}`);
                    // ロード完了後、開いているモーダルを全て閉じる
                    if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                    if (year2025DetailModal) year2025DetailModal.classList.remove('active');
                    console.log("[Modal] All relevant modals closed after setlist load.");
                }).catch(error => {
                    console.error("[setlist-link click] Error loading setlist:", error);
                    showMessageBox('セットリストのロードに失敗しました。');
                });
            } else {
                console.log("[setlist-link click] Standard link clicked, allowing default navigation.");
                // 通常のリンクでもモーダルは閉じる
                if (pastSetlistsModal) pastSetlistsModal.classList.remove('active');
                if (year2025DetailModal) year2025DetailModal.classList.remove('active');
            }
        });
    });

    // --- ページ初期ロード時の状態復元 ---
    // loadAlbumData() は外部JSONファイルのロードを想定しているため、ここではコメントアウトしています。
    // 必要に応じて、Firebaseからアルバムデータをロードするロジックや、HTMLに直接埋め込まれた
    // アルバムデータを使うロジックを追加してください。
    // loadAlbumData();

    loadSetlistState().then(() => {
      console.log("[DOMContentLoaded] loadSetlistState finished. Performing final cleanup.");
      hideSetlistItemsInMenu(); // 初期ロード後にセットリスト内のアイテムをアルバムメニューから隠す
    }).catch(error => {
      console.error("[DOMContentLoaded] Error during loadSetlistState:", error);
      hideSetlistItemsInMenu(); // エラー時もメニューの表示状態を調整
    });
});