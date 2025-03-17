const setlist = document.getElementById("setlist");
    let draggingItem = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoveX = 0;
    let touchMoveY = 0;
    let lastTapTime = 0;
    const maxSongs = 24;
    const originalAlbumMap = new Map(); // 元のアルバムを記憶
    
    function enableDragAndDrop(list) {
        list.querySelectorAll(".item").forEach(item => {
            if (!originalAlbumMap.has(item)) {
                originalAlbumMap.set(item, list);
            }
    
            // **PC用ドラッグ**
            item.addEventListener("dragstart", (event) => {
                draggingItem = item;
                item.classList.add("dragging");
                event.dataTransfer.setData("text/plain", "");
            });
    
            item.addEventListener("dragend", () => {
                finishDragging();
            });
    
            // **スマホ用タッチドラッグ**
            item.addEventListener("touchstart", (event) => {
                draggingItem = item;
                item.classList.add("dragging");
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                event.preventDefault();
            });
    
            item.addEventListener("touchmove", (event) => {
                if (!draggingItem) return;
                event.preventDefault();
                touchMoveX = event.touches[0].clientX;
                touchMoveY = event.touches[0].clientY;
    
                // **上下左右自由に動かす**
                draggingItem.style.transition = "transform 0s"; 
                draggingItem.style.transform = `translate(${touchMoveX - touchStartX}px, ${touchMoveY - touchStartY}px)`;
            });
    
            item.addEventListener("touchend", (event) => {
                if (!draggingItem) return;
    
                const currentTime = new Date().getTime();
                if (currentTime - lastTapTime < 300) {  
                    restoreToOriginalList(item);
                    lastTapTime = 0; 
                    event.preventDefault();
                    return;
                }
                lastTapTime = currentTime;
    
                const touch = event.changedTouches[0];
                const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        
                if (dropTarget) {
                    handleDrop(dropTarget, touch.clientY);
                }
    
                draggingItem.style.transition = "transform 0.2s ease";
                draggingItem.style.transform = "translate(0, 0)"; 
                setTimeout(() => {
                    draggingItem.style.transition = "";
                }, 200);
    
                finishDragging();
            });
    
            // **ダブルクリックで元のリストに戻す**
            item.addEventListener("dblclick", () => {
                restoreToOriginalList(item);
            });
        });
    
        list.addEventListener("dragover", (event) => {
            event.preventDefault();
            if (!draggingItem) return;
    
            const closestItem = getClosestItem(event.clientY);
            if (closestItem) {
                const bounding = closestItem.getBoundingClientRect();
                const offset = event.clientY - bounding.top;
                if (offset > bounding.height / 2) {
                    closestItem.after(draggingItem);
                } else {
                    closestItem.before(draggingItem);
                }
            }
        });
    
        list.addEventListener("drop", (event) => {
            event.preventDefault();
            if (!draggingItem) return;
            handleDrop(event.target, event.clientY);
            finishDragging();
        });
    }
    
    function getClosestItem(y) {
        const items = [...setlist.children];
        return items.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    function handleDrop(target, y) {
        let dropList = setlist;
    
        while (target && target !== document.body) {
            if (target === setlist) {
                dropList = setlist;
                break;
            }
            target = target.parentElement;
        }
    
        if (dropList === setlist && setlist.children.length < maxSongs) {
            const closestItem = getClosestItem(y);
            if (closestItem) {
                const bounding = closestItem.getBoundingClientRect();
                const offset = y - bounding.top;
                if (offset > bounding.height / 2) {
                    closestItem.after(draggingItem);
                } else {
                    closestItem.before(draggingItem);
                }
            } else {
                setlist.appendChild(draggingItem);
            }
        }
    }
    
    function finishDragging() {
        if (!draggingItem) return;
        draggingItem.classList.remove("dragging");
        draggingItem = null;
    }
    
    // **元のリストに戻す処理**
    function restoreToOriginalList(item) {
        const originalList = originalAlbumMap.get(item);
        if (originalList) {
            originalList.appendChild(item);
        }
    }
    
    function toggleMenu() {
        const menu = document.getElementById("menu");
        const menuButton = document.getElementById("menuButton");
    
        menu.classList.toggle("open");
        menuButton.classList.toggle("open");
    }
    
    function toggleAlbum(albumIndex) {
        document.querySelectorAll(".album-content").forEach(content => {
            if (content.id === "album" + albumIndex) {
                content.classList.toggle("active");
            } else {
                content.classList.remove("active");
            }
        });
    }
    
    enableDragAndDrop(setlist);
    document.querySelectorAll(".album-content").forEach(enableDragAndDrop);

    function getSetlist() {
            const items = document.querySelectorAll(".setlist-item");
            return Array.from(items).map((item, index) => `${index + 1}. ${item.textContent.trim().replace("📤", "").trim()}`);
        }

        function shareSetlist() {
            const message = `セットリスト:\n${getSetlist().join("\n")}`;

            if (navigator.share) {
                navigator.share({ text: message })
                    .catch(error => console.log("共有に失敗しました", error));
            } else {
                alert("共有機能がサポートされていません");
            }
        }

        document.querySelectorAll(".send-button").forEach(button => {
            button.addEventListener("click", shareSetlist);
        });

        function addToSetlist(songName) {
            const setlist = document.getElementById("setlist");
            const li = document.createElement("li");
            li.textContent = songName;
            setlist.appendChild(li);
        }

        function addToSetlist(songName) {
            const setlist = document.getElementById("setlist");
            const li = document.createElement("li");
            li.textContent = songName;
            setlist.appendChild(li);
        }

        function shareSetlist() {
            const setlistItems = document.querySelectorAll("#setlist li");
            if (setlistItems.length === 0) {
                alert("セットリストに曲がありません！");
                return;
            }

            let songList = "\n";
            setlistItems.forEach(item => {
                songList += " " + item.textContent + "\n";
            });

            // 共有APIが使えるかチェック
            if (navigator.share) {
                navigator.share({
                    title: "仮セトリ",
                    text: songList
                }).catch(error => console.error("共有に失敗しました:", error));
            } else {
                alert("お使いのブラウザでは共有機能が利用できません。");
            }
        }