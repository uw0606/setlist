let draggingItem = null;
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false;
const maxSongs = 24;
const originalAlbumMap = new Map();
const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.getElementById("albumList");

/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} list - 有効にするリストの要素
 */
function enableDragAndDrop(list) {
    list.querySelectorAll(".item").forEach(item => {
        if (!originalAlbumMap.has(item)) {
            originalAlbumMap.set(item, list);
        }
        item.addEventListener("dragstart", (event) => {
            draggingItem = item;
            item.classList.add("dragging");
            event.dataTransfer.setData("text/plain", "");
        });
        item.addEventListener("dragend", finishDragging);
        item.addEventListener("touchstart", () => {
            draggingItem = item;
            item.classList.add("touchstart");
        });
        item.addEventListener("touchend", finishDragging);
    });
    list.addEventListener("dragover", handleDragOver);
    list.addEventListener("drop", handleDrop);
}

/**
 * ドラッグオーバー時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDragOver(event) {
    event.preventDefault();
    if (!draggingItem) return;
    const closestItem = getClosestItem(event.clientY);
    if (closestItem) {
        const bounding = closestItem.getBoundingClientRect();
        const offset = event.clientY - bounding.top;
        offset > bounding.height / 2 ? closestItem.after(draggingItem) : closestItem.before(draggingItem);
    }
}

/**
 * 指定されたY座標に最も近いアイテムを取得する。
 * @param {number} y - Y座標
 * @returns {Element} 最も近いアイテム
 */
function getClosestItem(y) {
    return [...setlist.children].reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * ドロップ時の処理。
 * @param {DragEvent} event - ドラッグイベント
 */
function handleDrop(event) {
  event.preventDefault();
  if (!draggingItem) return;
  const isMovingInSetlist = draggingItem.parentNode === setlist;

  if (!isMovingInSetlist && setlist.children.length < maxSongs) {
    // ハンバーガーメニューからセットリストへの移動
    const closestItem = getClosestItem(event.clientY);
    if (closestItem) {
      const bounding = closestItem.getBoundingClientRect();
      const offset = event.clientY - bounding.top;
      offset > bounding.height / 2 ? closestItem.after(draggingItem) : closestItem.before(draggingItem);
    } else {
      setlist.appendChild(draggingItem);
    }

    const songInfo = document.createElement("div");
    songInfo.classList.add("song-info");
    songInfo.textContent = draggingItem.textContent;

    if (draggingItem.classList.contains("short")) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      songInfo.appendChild(checkbox);
      const label = document.createElement("span");
      label.textContent = "(Short)";
      songInfo.appendChild(label);
    }

    draggingItem.innerHTML = "";
    draggingItem.appendChild(songInfo);
    draggingItem.classList.add("setlist-item");
    songInfo.style.paddingLeft = "20px";

    // 元のリストから削除する処理
    const originalList = originalAlbumMap.get(draggingItem);
    if (originalList) {
      originalList.removeChild(draggingItem);
      originalAlbumMap.delete(draggingItem);
    }
  } else if (isMovingInSetlist) {
    // セットリスト内での移動
    const closestItem = getClosestItem(event.clientY);
    if (closestItem) {
      const bounding = closestItem.getBoundingClientRect();
      const offset = event.clientY - bounding.top;
      offset > bounding.height / 2 ? closestItem.after(draggingItem) : closestItem.before(draggingItem);
    }
  }
  finishDragging();
}

/**
 * ドラッグ終了時の処理。
 */
function finishDragging() {
    if (!draggingItem) return;
    draggingItem.classList.remove("dragging");
    draggingItem = null;
}


/**
 * アイテムを元のリストに戻す。
 * @param {Element} item - 元に戻すアイテム
 */
function restoreToOriginalList(item) {
  const originalList = originalAlbumMap.get(item);
  if (originalList) {
    // 元のリスト内での元の位置に要素を挿入
    const originalIndex = Array.from(originalList.children).findIndex(child => child.textContent === item.textContent);
    if (originalIndex !== -1) {
      originalList.insertBefore(item, originalList.children[originalIndex]);
    } else {
      originalList.appendChild(item);
    }

    // チェックボックスとラベルを削除
    const checkbox = item.querySelector("input[type='checkbox']");
    if (checkbox) {
      checkbox.remove();
    }
    const label = item.querySelector("span");
    if (label) {
      label.remove();
    }
  }
}

document.addEventListener("dblclick", (event) => {
  const item = event.target.closest(".item");
  if (!item) return;
  event.preventDefault();
  event.stopPropagation();
  if (!!event.target.closest("#setlist")) {
    // セットリストからハンバーガーメニューに戻す処理 (修正)
    restoreToOriginalList(item);
    item.classList.remove("setlist-item");
    const songInfo = item.querySelector(".song-info");
    if (songInfo) {
      const checkbox = songInfo.querySelector("input[type='checkbox']");
      if (checkbox) {
        checkbox.remove();
      }
      const label = songInfo.querySelector("span");
      if (label) {
        label.remove();
      }
      item.textContent = songInfo.childNodes[0].textContent.trim();
    }
  } else {
    // セットリストの一番下に追加 (既存の処理)
    if (setlist.children.length < maxSongs) {
      setlist.appendChild(item);

      const songInfo = document.createElement("div");
      songInfo.classList.add("song-info");
      songInfo.textContent = item.textContent;

      if (item.classList.contains("short") && !item.querySelector(".song-info span")) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        songInfo.appendChild(checkbox);
        const label = document.createElement("span");
        label.textContent = "(Short)";
        songInfo.appendChild(label);
      } else if (item.classList.contains("short") && item.querySelector(".song-info input[type='checkbox']") && !item.querySelector(".song-info span")) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        songInfo.appendChild(checkbox);
        const label = document.createElement("span");
        label.textContent = "(Short)";
        songInfo.appendChild(label);
      } else if (item.classList.contains("short") && !item.querySelector(".song-info input[type='checkbox']") && item.querySelector(".song-info span")) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        songInfo.insertBefore(checkbox, songInfo.querySelector("span"));
      }

      item.innerHTML = "";
      item.appendChild(songInfo);
      item.classList.add("setlist-item");
      songInfo.style.paddingLeft = "20px";

      const originalList = originalAlbumMap.get(item);
      if (originalList) {
        originalList.removeChild(item);
        originalAlbumMap.delete(item);
      }
    }
  }
});



/**
 * メニューの開閉を切り替える。
 */
function toggleMenu() {
    menu.classList.toggle("open");
    menuButton.classList.toggle("open");
}

/**
 * アルバムの表示を切り替える。
 * @param {number} albumIndex - 切り替えるアルバムのインデックス
 */
function toggleAlbum(albumIndex) {
    document.querySelectorAll(".album-content").forEach(content => {
        content.id === "album" + albumIndex ? content.classList.toggle("active") : content.classList.remove("active");
    });
}

if (setlist) enableDragAndDrop(setlist);
document.querySelectorAll(".album-content").forEach(enableDragAndDrop);
// ダブルクリックのイベントリスナーは document に一度だけ設定されているはずです

/**
 * セットリストの内容を取得する。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
    return Array.from(document.querySelectorAll(".setlist-item"))
        .map((item, index) => `${index + 1}. ${item.textContent.trim().replace("📤", "").trim()}`);
}

/**
 * 現在のセットリストの状態とメニューの状態をオブジェクトで取得する。
 * @returns {object} 現在の状態
 */
function getCurrentState() {
  const setlistState = Array.from(setlist.children).map(item => {
    const songInfo = item.querySelector('.song-info');
    const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : item.textContent.trim();
    const checkbox = songInfo ? songInfo.querySelector('input[type="checkbox"]') : null;
    const isShort = item.classList.contains('short') ? (checkbox ? checkbox.checked : false) : false;
    const hasCheckbox = !!checkbox;
    const hasShortClass = item.classList.contains('short');
    const albumClass = Array.from(item.classList).find(className => className.startsWith('album'));
    return { name: songName, short: isShort, hasCheckbox: hasCheckbox, hasShortClass: hasShortClass, albumClass: albumClass };
  });

  const menuOpen = menu.classList.contains('open');
  const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

    // ハンバーガーメニューの各アルバムの曲リストの状態を保存
    const albumStates = {};
    document.querySelectorAll('.album-content').forEach(albumContent => {
      albumStates[albumContent.id] = Array.from(albumContent.querySelectorAll('.item')).map(item => item.textContent);
    });
  
    return {
      setlist: setlistState,
      menuOpen: menuOpen,
      openAlbums: openAlbums,
      albumStates: albumStates
    };
  }

function getAlbumStates() {
    const albumStates = {};
    document.querySelectorAll('.album-content').forEach(album => {
        albumStates[album.id] = Array.from(album.querySelectorAll('.item')).map(item => item.textContent);
    });
    return albumStates;
}

/**
 * Firebase Realtime Database に現在の状態を保存し、共有IDを生成する。
 */
function shareSetlist() {
    const currentState = getCurrentState();
    const setlistRef = database.ref('setlists').push(); // 'setlists' というキーでデータを保存

    setlistRef.set(currentState)
        .then(() => {
            const shareId = setlistRef.key;
            const shareLink = `${window.location.origin}${window.location.pathname}?shareId=${shareId}`;
            navigator.clipboard.writeText(shareLink);
            alert('共有リンクをクリップボードにコピーしました！');
        })
        .catch((error) => {
            console.error('セットリストの保存に失敗しました:', error);
            alert('セットリストの保存に失敗しました。');
        });
}

document.addEventListener('DOMContentLoaded', function() {
  /**
   * URLの共有IDに基づいて Firebase Realtime Database から状態をロードする。
   */
  function loadSetlistState() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('shareId');

    if (shareId) {
      const setlistRef = database.ref(`setlists/${shareId}`);
      setlistRef.once('value')
        .then((snapshot) => {
          const state = snapshot.val();
          if (state && state.setlist) {
            setlist.innerHTML = '';
            state.setlist.forEach(itemData => {
              const li = document.createElement('li');
              li.classList.add('setlist-item');
              li.draggable = true;
              li.innerHTML = `<div class="song-info">${itemData.name}</div>`;

              const songInfoDiv = li.querySelector('.song-info');
              if (songInfoDiv && itemData.hasCheckbox) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = !!itemData.short;
                songInfoDiv.appendChild(checkbox);

                if (itemData.hasShortClass) {
                  const label = document.createElement('span');
                  label.textContent = '(Short)';
                  songInfoDiv.appendChild(label);
                  li.classList.add('short');
                }
              }

              if (itemData.albumClass) {
                li.classList.add(itemData.albumClass);
              }

              setlist.appendChild(li);
            });
            enableDragAndDrop(setlist); // ← ★ この行が重要です ★

            if (state.menuOpen) {
              menu.classList.add('open');
              menuButton.classList.add('open');
            } else {
              menu.classList.remove('open');
              menuButton.classList.remove('open');
            }

            if (state.openAlbums && Array.isArray(state.openAlbums)) {
              document.querySelectorAll('.album-content').forEach(content => {
                if (state.openAlbums.includes(content.id)) {
                  content.classList.add('active');
                } else {
                  content.classList.remove('active');
                }
              });
            }
            

            // ハンバーガーメニューの状態を復元
            if (state.albumStates) {
              document.querySelectorAll('.album-content').forEach(albumContent => {
                const savedSongs = state.albumStates[albumContent.id];
                if (savedSongs && Array.isArray(savedSongs)) {
                  albumContent.innerHTML = ''; // 現在のリストをクリア
                  savedSongs.forEach(songName => {
                    const li = document.createElement('li');
                    li.classList.add('item');
                    li.draggable = true;
                    li.textContent = songName;
                    const albumClass = albumContent.id.replace('album', 'album'); // 例: album1
                    li.classList.add(albumClass);
                    albumContent.appendChild(li);
                  });
                  enableDragAndDrop(albumContent); // イベントリスナーを再設定
                }
              });
            }

          } else {
            alert('共有されたセットリストが見つかりませんでした。');
          }
        })
        .catch((error) => {
          console.error('セットリストのロードに失敗しました:', error);
          alert('セットリストのロードに失敗しました。');
        });
    }
  }

  // ページ読み込み時に共有IDがあれば状態をロード
  loadSetlistState();
});




// 文字共有機能 (既存のコード - 変更なし)
function shareTextSetlist() {
    const setlistItems = document.querySelectorAll("#setlist li");
    if (setlistItems.length === 0) {
        alert("セットリストに曲がありません！");
        return;
    }
    let songList = "\n" + Array.from(setlistItems).map(item => {
        const songName = item.querySelector(".song-info").childNodes[0].textContent.trim();
        const checkbox = item.querySelector("input[type='checkbox']");
        return checkbox && checkbox.checked ? " " + songName + " (Short)" : " " + songName;
    }).join("\n");
    navigator.share ? navigator.share({ title: "仮セトリ(テキスト)", text: songList }).catch(console.error) : alert("お使いのブラウザでは共有機能が利用できません。");
}

// イベントリスナー (既存のコード - 共有ボタンの処理を修正)
// document.getElementById('shareSetlistButton').addEventListener('click', shareSetlist); // onclick属性で処理しているので削除

if (albumList) {
    albumList.querySelectorAll('.album-content').forEach(enableDragAndDrop);
}