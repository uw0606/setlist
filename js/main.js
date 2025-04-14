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


function saveSetlistState() {
  const setlistItems = Array.from(document.querySelectorAll('#setlist li')).map(item => {
    const songInfo = item.querySelector('.song-info');
    const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : item.textContent.trim();
    const checkbox = songInfo ? songInfo.querySelector('input[type="checkbox"]') : null;
    const isShort = checkbox ? checkbox.checked : false;
    return { name: songName, short: isShort };
  });

  const albumItems = {};
  document.querySelectorAll('.album-content').forEach(album => {
    albumItems[album.id] = Array.from(album.querySelectorAll('.item')).map(item => item.textContent);
  });

  const state = { setlist: setlistItems, albums: albumItems };

  fetch('/api/setlist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  }).catch(error => {
    console.error('セットリストの状態の保存に失敗しました。', error);
    alert('セットリストの状態の保存に失敗しました。');
  });
}

// セットリストの状態をサーバーから復元する関数
function loadSetlistState(shareId) {
  fetch(`/api/setlist/load?id=${shareId}`)
    .then(response => response.json())
    .then(state => {
      if (state) {
        setlist.innerHTML = state.setlist.map(item => {
          const songInfo = document.createElement('div');
          songInfo.classList.add('song-info');
          songInfo.textContent = item.name;
          if (item.short) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            songInfo.appendChild(checkbox);
            const label = document.createElement('span');
            label.textContent = '(Short)';
            songInfo.appendChild(label);
          }
          const li = document.createElement('li');
          li.classList.add('setlist-item');
          li.appendChild(songInfo);
          return li.outerHTML;
        }).join('');

        for (const albumId in state.albums) {
          const album = document.getElementById(albumId);
          album.innerHTML = state.albums[albumId].map(item => `<li class="item">${item}</li>`).join('');
        }
      }
    })
    .catch(error => {
      console.error('セットリストの状態の復元に失敗しました。', error);
      alert('セットリストの状態の復元に失敗しました。');
    });
}


document.getElementById('shareSetlistButton').addEventListener('click', () => {
  const setlistState = getSetlistState();

  fetch('/api/setlist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setlistState)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('セットリストの保存に失敗しました。');
    }
    return response.json();
  })
  .then(data => {
    // 現在のサイトのオリジンを取得し、パスと共有 ID を結合
    const shareLink = `${window.location.origin}${window.location.pathname}?id=${data.shareId}`;
    navigator.clipboard.writeText(shareLink);
    alert('共有リンクをクリップボードにコピーしました。');
  })
  .catch(error => {
    console.error('セットリストの状態の保存に失敗しました。', error);
    alert('セットリストの状態の保存に失敗しました。');
  });
});

// セットリストの状態を取得する関数の例（必要に応じて実装してください）
function getSetlistState() {
  const setlistItems = Array.from(document.querySelectorAll('#setlist li')).map(item => {
    const songInfo = item.querySelector('.song-info');
    const songName = songInfo ? songInfo.childNodes[0].textContent.trim() : item.textContent.trim();
    const checkbox = songInfo ? songInfo.querySelector('input[type="checkbox"]') : null;
    const isShort = checkbox ? checkbox.checked : false;
    return { name: songName, short: isShort };
  });

  const albumItems = {};
  document.querySelectorAll('.album-content').forEach(album => {
    albumItems[album.id] = Array.from(album.querySelectorAll('.item')).map(item => item.textContent);
  });

  // ハンバーガーメニューの状態を取得
  const menuOpen = document.getElementById('menu').classList.contains('open');

  // 開いているアルバムの情報を取得
  const openAlbums = Array.from(document.querySelectorAll('.album-content.active')).map(album => album.id);

  return {
    setlist: setlistItems,
    albums: getAlbumStates(), // アルバム内の曲リストの状態も保持する場合
    menuOpen: menuOpen,
    openAlbums: openAlbums
  };
}

// アルバムの状態を取得する関数（必要に応じて実装）
function getAlbumStates() {
  const albumStates = {};
  document.querySelectorAll('.album-content').forEach(album => {
    albumStates[album.id] = Array.from(album.querySelectorAll('.item')).map(item => item.textContent);
  });
  return albumStates;
}

document.getElementById('shareSetlistButton').addEventListener('click', () => {
  const setlistState = getSetlistState();

  fetch('/api/setlist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setlistState)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('セットリストの状態の保存に失敗しました。');
    }
    return response.json();
  })
  .then(data => {
    const shareLink = `${window.location.origin}${window.location.pathname}?id=${data.shareId}`;
    navigator.clipboard.writeText(shareLink);
    alert('共有リンクをクリップボードにコピーしました。');
  })
  .catch(error => {
    console.error('セットリストの状態の保存に失敗しました。', error);
    alert('セットリストの状態の保存に失敗しました。');
  });
});

// ページ読み込み時に共有 ID が URL に含まれている場合は、セットリストの状態を復元する
const urlParams = new URLSearchParams(window.location.search);
const shareId = urlParams.get('id');
if (shareId) {
  fetch(`/api/setlist/load?id=${shareId}`)
    .then(response => response.json())
    .then(state => {
      if (state) {
        setlist.innerHTML = state.setlist.map(item => `<li>${item}</li>`).join('');
        for (const albumId in state.albums) {
          const album = document.getElementById(albumId);
          album.innerHTML = state.albums[albumId].map(item => `<li class="item">${item}</li>`).join('');

          // アルバムの状態の復元（必要に応じて）
        if (state.albums) {
          for (const albumId in state.albums) {
            const album = document.getElementById(albumId);
            if (album) {
              album.innerHTML = state.albums[albumId].map(item => `<li class="item" draggable="true">${item}</li>`).join('');
              enableDragAndDrop(album); // ドラッグ＆ドロップを再度有効にする
            }
          }
        }

        // ハンバーガーメニューの状態を復元
        if (state.menuOpen) {
          document.getElementById('menu').classList.add('open');
          document.getElementById('menuButton').classList.add('open');
        } else {
          document.getElementById('menu').classList.remove('open');
          document.getElementById('menuButton').classList.remove('open');
        }

        // 開いているアルバムの状態を復元
        if (state.openAlbums && Array.isArray(state.openAlbums)) {
          document.querySelectorAll('.album-content').forEach(content => content.classList.remove('active'));
          state.openAlbums.forEach(albumId => {
            const albumContent = document.getElementById(albumId);
            if (albumContent) {
              albumContent.classList.add('active');
            }
          });
        }
      }
    }
    })
    .catch(error => {
      console.error('セットリストの状態の復元に失敗しました。', error);
      alert('セットリストの状態の復元に失敗しました。');
    });
}

// セットリストを共有する関数
function shareSetlist() {
  // セットリストの状態を取得する関数（getSetlistState() はクライアント側で実装する必要があります）
  const setlistState = getSetlistState();

  // サーバーにセットリストの状態を送信し、共有 ID を取得する
  fetch('/api/setlist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setlistState)
  })
  .then(response => response.json())
  .then(data => {
    // 共有リンクを生成し、クリップボードにコピーする
    const shareLink = `http://localhost:3000/setlist/shared?id=${data.shareId}`;
    navigator.clipboard.writeText(shareLink);
    alert('共有リンクをクリップボードにコピーしました。');
  })
  .catch(error => {
    console.error('セットリストの状態の保存に失敗しました。', error);
    alert('セットリストの状態の保存に失敗しました。');
  });
}

// 共有ボタンにイベントリスナーを設定
document.getElementById('shareSetlistButton').addEventListener('click', shareSetlist);


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