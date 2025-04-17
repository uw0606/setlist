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
  if (setlist.children.length < maxSongs) {
      const closestItem = getClosestItem(event.clientY);
      if (closestItem) {
          const bounding = closestItem.getBoundingClientRect();
          const offset = event.clientY - bounding.top;
          offset > bounding.height / 2 ? closestItem.after(draggingItem) : closestItem.before(draggingItem);
      } else {
          setlist.appendChild(draggingItem);
      }

      const songInfo = draggingItem.querySelector(".song-info");
      const hasShortLabel = songInfo && songInfo.querySelector("span");
      const hasCheckbox = songInfo && songInfo.querySelector("input[type='checkbox']");

      if (draggingItem.classList.contains("short") && !hasShortLabel) {
          if (!songInfo) {
              const newSongInfo = document.createElement("div");
              newSongInfo.classList.add("song-info");
              newSongInfo.textContent = draggingItem.textContent;
              draggingItem.innerHTML = "";
              draggingItem.appendChild(newSongInfo);
          }
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          songInfo.appendChild(checkbox);
          const label = document.createElement("span");
          label.textContent = "(Short)";
          songInfo.appendChild(label);
      } else if (draggingItem.classList.contains("short") && hasCheckbox && !hasShortLabel) {
          const label = document.createElement("span");
          label.textContent = "(Short)";
          songInfo.appendChild(label);
      } else if (draggingItem.classList.contains("short") && !hasCheckbox && hasShortLabel) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          songInfo.insertBefore(checkbox, songInfo.querySelector("span"));
      }

      if (songInfo) {
          songInfo.style.paddingLeft = "20px";
      }
      draggingItem.classList.add("setlist-item");
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
      // セットリストからハンバーガーメニューに戻す際に、元の要素を移動
      restoreToOriginalList(item);
      item.classList.remove("setlist-item"); // setlist-item クラスを削除
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
          item.textContent = songInfo.childNodes[0].textContent.trim(); // songInfo div のテキストを item に戻す
      }
  } else {
      // セットリストの一番下に追加
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
      const isShort = item.classList.contains('short') ? (checkbox ? checkbox.checked : false) : false; // short クラスがあればチェック状態を取得
      const hasShortClass = item.classList.contains('short'); // short クラスの有無を保存
      const albumClass = Array.from(item.classList).find(className => className.startsWith('album'));
      return { name: songName, short: isShort, hasShortClass: hasShortClass, albumClass: albumClass }; // hasShortClass を追加
  });

  const menuOpen = menu.classList.contains('open');
  const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);
  const albumStates = getAlbumStates();

  return {
      setlist: setlistState,
      menuOpen: menuOpen,
      openAlbums: openAlbums,
      albums: albumStates
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
                      li.classList.add('item'); // ★ 明示的に .item クラスを付与
                      li.innerHTML = `<div class="song-info">${itemData.name}</div>`;

                      const songInfoDiv = li.querySelector('.song-info');
                      if (songInfoDiv && itemData.hasShortClass) {
                          const checkbox = document.createElement('input');
                          checkbox.type = 'checkbox';
                          checkbox.checked = !!itemData.short;
                          songInfoDiv.appendChild(checkbox);
                          const label = document.createElement('span');
                          label.textContent = '(Short)';
                          songInfoDiv.appendChild(label);
                          li.classList.add('short');
                      } else if (songInfoDiv) {
                          const checkbox = document.createElement('input');
                          checkbox.type = 'checkbox';
                          songInfoDiv.appendChild(checkbox);
                      }

                      li.draggable = true;
                      if (itemData.albumClass) {
                          li.classList.add(itemData.albumClass);
                      }

                      setlist.appendChild(li);
                  });
                  enableDragAndDrop(setlist);
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