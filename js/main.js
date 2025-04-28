let draggingItem = null;
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false;
const originalAlbumMap = new Map();
const setlist = document.getElementById("setlist");
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuButton");
const albumList = document.getElementById("albumList");
const maxSongs = 24;

/**
 * ドラッグ＆ドロップを有効にする関数。
 * @param {Element} list - 有効にするリストの要素
 */
function enableDragAndDrop(list) {
  list.querySelectorAll(".item").forEach(item => {
    item.addEventListener("dragstart", (event) => {
      const draggedItem = event.target.closest(".item");
      if (draggedItem) {
        draggingItemId = draggedItem.dataset.itemId;
    
        // ★ すでに originalAlbumMap に存在しているなら、上書きしない！
        if (!originalAlbumMap.has(draggingItemId)) {
          const originalList = draggedItem.parentNode;
          const originalListId = originalList ? originalList.id : null;
          originalAlbumMap.set(draggingItemId, originalListId); 
          console.log("dragStart - itemId:", draggingItemId, "originalListId (newly set):", originalListId);
        } else {
          console.log("dragStart - itemId:", draggingItemId, "originalListId (already exists):", originalAlbumMap.get(draggingItemId));
        }
    
        draggedItem.classList.add("dragging");
        event.dataTransfer.setData("text/plain", "");
      }
    });
    item.addEventListener("dragend", finishDragging);
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
  if (!draggingItemId) return;
  const draggedItem = document.querySelector(`[data-item-id="${draggingItemId}"]`);
  if (!draggedItem) return;

  if (setlist.children.length < maxSongs) {
    const originalListId = originalAlbumMap.get(draggingItemId);
    const originalList = originalListId ? document.getElementById(originalListId) : null;
    console.log("handleDrop - itemId:", draggingItemId, "originalListId:", originalListId, "originalList element:", originalList);
    if (originalList && originalList.contains(draggedItem)) { // 元のリストにまだ存在する場合のみ削除
      originalList.removeChild(draggedItem);
    }

    const closestItem = getClosestItem(event.clientY);
    if (closestItem) {
      const bounding = closestItem.getBoundingClientRect();
      const offset = event.clientY - bounding.top;
      offset > bounding.height / 2 ? closestItem.after(draggedItem) : closestItem.before(draggedItem);
    } else {
      // ★ 強制的に元のアルバム ID を設定し直す
      originalAlbumMap.set(draggingItemId, originalListId);
      setlist.appendChild(draggedItem);
    }

      let songInfo = draggedItem.querySelector(".song-info");
      if (!songInfo) {
          songInfo = document.createElement("div");
          songInfo.classList.add("song-info");
          draggedItem.appendChild(songInfo);
      }
      while (draggedItem.firstChild) {
          draggedItem.removeChild(draggedItem.firstChild);
      }
      draggedItem.appendChild(songInfo);
      const songName = draggedItem.getAttribute('data-song-name') || draggedItem.textContent.trim();
      songInfo.textContent = songName;
      if (draggedItem.classList.contains("short")) {
          let checkbox = songInfo.querySelector("input[type='checkbox']");
          let label = songInfo.querySelector("span");
          if (!checkbox) {
              checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              songInfo.appendChild(checkbox);
          }
          if (!label) {
              label = document.createElement("span");
              label.textContent = "(Short)";
              songInfo.appendChild(label);
          }
      }
      draggedItem.classList.add("setlist-item");
      songInfo.style.paddingLeft = "20px";
  }
  finishDragging();
  console.log("handleDrop - originalAlbumMap after drop:", originalAlbumMap); // ★ 追加
}



/**
 * ドラッグ終了時の処理。
 */
function finishDragging() {
  const draggedItem = document.querySelector(`[data-item-id="${draggingItemId}"]`);
  if (draggedItem) {
    console.log("finishDragging - itemId:", draggingItemId, "parentNode:", draggedItem.parentNode ? draggedItem.parentNode.id : null);
    draggedItem.classList.remove("dragging");
    // ★ 以下の行を削除またはコメントアウト
    // if (draggedItem.parentNode === setlist) {
    //   originalAlbumMap.set(draggingItemId, setlist.id);
    //   console.log("finishDragging - updated originalAlbumMap for:", draggingItemId, "to:", setlist.id);
    //   console.log("finishDragging - originalAlbumMap after set:", originalAlbumMap); // ★ 追加
    // }
  }
  draggingItemId = null;
}


/**
 * アイテムを元のリストに戻す。
 * @param {Element} item - 元に戻すアイテム
 */
function restoreToOriginalList(item) {
  console.log("restoreToOriginalList - item dataset.itemId:", item.dataset.itemId);
  const itemId = item.dataset.itemId;
  console.log("restoreToOriginalList - itemId to restore:", itemId);
  const originalListId = originalAlbumMap.get(itemId);
  console.log("restoreToOriginalList - originalListId from map:", originalListId);
  const originalList = originalListId ? document.getElementById(originalListId) : null;
  console.log("restoreToOriginalList - originalList (by id):", originalList);
  const itemToRestore = document.querySelector(`[data-item-id="${itemId}"]`);
  if (originalList && itemToRestore) {
    console.log("restoreToOriginalList - appending to:", originalList);
    originalList.appendChild(itemToRestore);
    originalAlbumMap.delete(itemId);
  } else {
    console.warn("restoreToOriginalList - originalList not found for id:", itemId);
  }
}

document.addEventListener("dblclick", (event) => {
  const item = event.target.closest(".item");
  if (!item) return;
  event.preventDefault();
  event.stopPropagation();

  if (!!event.target.closest("#setlist")) {
    console.log("dblclick (setlist) - originalAlbumMap:", originalAlbumMap);
    const itemId = item.dataset.itemId;
    const originalListId = originalAlbumMap.get(itemId);
    const originalList = originalListId ? document.getElementById(originalListId) : null;
    const itemToRestore = item; // ←ここ修正！

    if (originalList && itemToRestore) {
      originalList.appendChild(itemToRestore);
      originalAlbumMap.delete(itemId);
      item.classList.remove("setlist-item");
      const songInfo = item.querySelector(".song-info");
      if (songInfo) {
        const checkbox = songInfo.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.remove();
        const label = songInfo.querySelector("span");
        if (label) label.remove();
        while (item.firstChild) {
          item.removeChild(item.firstChild);
        }
        item.textContent = songInfo.childNodes[0].textContent.trim();
      }
      item.dataset.returned = true;
    } else {
      console.warn("restoreToOriginalList - originalList not found for id:", itemId);
    }
  } else {
    if (setlist.children.length < maxSongs && !item.classList.contains("setlist-item")) {
        const itemId = item.dataset.itemId;
        const originalList = item.parentNode; // ← 元の親要素を取得
        originalAlbumMap.set(itemId, originalList ? originalList.id : null); // ← originalAlbumMap に保存
        if (originalList) {
            originalList.removeChild(item);
        }
        setlist.appendChild(item);
          // ... (同様の songInfo の作成と追加処理) ...
          let songInfo = document.createElement("div");
          songInfo.classList.add("song-info");
          songInfo.textContent = item.textContent;
          if (item.classList.contains("short")) {
              let checkbox = songInfo.querySelector("input[type='checkbox']");
              let label = songInfo.querySelector("span");
              if (!checkbox) {
                  checkbox = document.createElement("input");
                  checkbox.type = "checkbox";
                  songInfo.appendChild(checkbox);
              }
              if (!label) {
                  label = document.createElement("span");
                  label.textContent = "(Short)";
                  songInfo.appendChild(label);
              }
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

              const checkboxElement = songInfoDiv.querySelector('input[type="checkbox"]');
              if (checkboxElement) {
                checkboxElement.addEventListener('change', function() {
                  console.log(`Checkbox for ${itemData.name} changed to: ${this.checked}`);
                });
              }
            }

            li.draggable = true;
            if (itemData.albumClass) {
              li.classList.add(itemData.albumClass);
            }

            setlist.appendChild(li);
          });
          enableDragAndDrop(setlist);

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


if (albumList) {
    albumList.querySelectorAll('.album-content').forEach(enableDragAndDrop);
}


function finishDragging() {
  const draggedItem = document.querySelector(`[data-item-id="${draggingItemId}"]`);
  if (draggedItem) {
      draggedItem.classList.remove("dragging");
  }
  draggingItemId = null;
}

// ... (toggleMenu, toggleAlbum, getSetlist, getCurrentState, getAlbumStates, shareSetlist, loadSetlistState, shareTextSetlist の関数は変更ありません)

document.addEventListener("DOMContentLoaded", () => {
  const albumContents = document.querySelectorAll(".album-content");
  albumContents.forEach(album => {
      album.querySelectorAll(".item").forEach((item, index) => {
          if (!item.dataset.itemId) {
              item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          }
      });
      enableDragAndDrop(album);
  });
  if (setlist) {
      setlist.querySelectorAll(".item").forEach((item, index) => {
          if (!item.dataset.itemId) {
              item.dataset.itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          }
      });
      enableDragAndDrop(setlist);
  }
  loadSetlistState();
});


