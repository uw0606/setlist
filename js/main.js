let draggingItem = null;
let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;
let isDragging = false;
const maxSongs = 24;
const originalAlbumMap = new Map();


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
    } else {
        // セットリストの一番下に追加
        if (setlist.children.length < maxSongs) {
            setlist.appendChild(item);

            // 曲名とチェックボックスを囲む要素を作成
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info");

            // 曲名をsongInfoに追加
            const songName = document.createTextNode(item.textContent);
            songInfo.appendChild(songName);

            // SEまたはトキノナミダの場合にチェックボックスを追加
            if (item.textContent.trim() === "SE" || item.textContent.trim() === "トキノナミダ") {
                const newCheckbox = document.createElement("input");
                newCheckbox.type = "checkbox";
                songInfo.appendChild(newCheckbox);

                // ラベルを追加
                const label = document.createElement("span");
                label.textContent = "(Short)";
                songInfo.appendChild(label);
            }

            // itemの内容をsongInfoで置き換える
            item.innerHTML = "";
            item.appendChild(songInfo);
            item.classList.add("setlist-item");

            // 曲名の余白に関するスタイルを追加
            songInfo.style.paddingLeft = "20px";
        }
    }
});

/**
 * メニューの開閉を切り替える。
 */
function toggleMenu() {
    document.getElementById("menu").classList.toggle("open");
    document.getElementById("menuButton").classList.toggle("open");
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

const setlist = document.getElementById("setlist");
if (setlist) enableDragAndDrop(setlist);
document.querySelectorAll(".album-content").forEach(enableDragAndDrop);


/**
 * セットリストの内容を取得する。
 * @returns {string[]} セットリストの曲リスト
 */
function getSetlist() {
    return Array.from(document.querySelectorAll(".setlist-item"))
        .map((item, index) => `${index + 1}. ${item.textContent.trim().replace("📤", "").trim()}`);
}


// セットリストの状態をサーバーに保存
function saveSetlistState() {
  const setlistItems = Array.from(document.querySelectorAll('#setlist li')).map(item => item.textContent);
  const albumItems = {};
  document.querySelectorAll('.album-content').forEach(album => {
    albumItems[album.id] = Array.from(album.querySelectorAll('.item')).map(item => item.textContent);
  });
  const state = { setlist: setlistItems, albums: albumItems };
  fetch('/api/setlist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
}

// セットリストの状態をサーバーから復元
function loadSetlistState() {
  fetch('/api/setlist/load')
    .then(response => response.json())
    .then(state => {
      if (state) {
        setlist.innerHTML = state.setlist.map(item => `<li>${item}</li>`).join('');
        for (const albumId in state.albums) {
          const album = document.getElementById(albumId);
          album.innerHTML = state.albums[albumId].map(item => `<li class="item">${item}</li>`).join('');
        }
      }
    });
}

// 共有ボタンがクリックされたときに状態を保存し、共有リンクを生成
document.getElementById('shareSetlistButton').addEventListener('click', () => {
  saveSetlistState();
  // 共有リンク生成処理（例：URL短縮サービス）
  const shareLink = 'http://localhost:3000/setlist/shared';
  navigator.clipboard.writeText(shareLink);
  alert('共有リンクをクリップボードにコピーしました。');
});

// ページ読み込み時に状態を復元
loadSetlistState();




/**
 * セットリストを共有する。
 */
// サイト共有機能
function shareSetlist() {
  // サイト共有リンクをクリップボードにコピーする処理
  const shareLink = 'https://uw0606.github.io/setlist/'; // 実際の共有リンクに置き換えてください
  navigator.clipboard.writeText(shareLink)
      .then(() => {
          alert('共有リンクをクリップボードにコピーしました。');
      })
      .catch(err => {
          console.error('共有リンクのコピーに失敗しました。', err);
          alert('共有リンクのコピーに失敗しました。');
      });
}

// 文字共有機能
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

// 共有ボタンにイベントリスナーを設定
document.getElementById('shareSetlistButton').addEventListener('click', shareSetlist);

// 文字共有ボタンにイベントリスナーを設定
document.querySelector('.send-all-button').addEventListener('click', shareTextSetlist);




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

            // 曲名とチェックボックスを囲む要素を作成
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info");

            // 曲名をsongInfoに追加
            const songName = document.createTextNode(draggingItem.textContent);
            songInfo.appendChild(songName);

            if (draggingItem.textContent.trim() === "トキノナミダ" || draggingItem.textContent.trim() === "SE") {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                songInfo.appendChild(checkbox);

                // ラベルを追加
                const label = document.createElement("span");
                label.textContent = "(Short)";
                songInfo.appendChild(label);
            }

            // draggingItemの内容をsongInfoで置き換える
            draggingItem.innerHTML = "";
            draggingItem.appendChild(songInfo);
            draggingItem.classList.add("setlist-item");

            // 曲名の余白に関するスタイルを追加
            songInfo.style.paddingLeft = "20px";
        }
        finishDragging();
    }