// server.js

const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

// MongoDB 接続 (既存のコード)
mongoose.connect("mongodb+srv://uw0606:uw06068510@cluster0.u3dmf9u.mongodb.net/setlist?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// セットリストのスキーマを修正
const setlistSchema = new mongoose.Schema({
  shareId: String,
  state: {
    setlist: Array, // セットリストのアイテム
    albums: Object, // アルバムの状態（必要に応じて）
    menuOpen: Boolean, // ハンバーガーメニューの状態
    openAlbums: Array // 開いているアルバムのID
  }
});

const Setlist = mongoose.model('Setlist', setlistSchema);

// セットリストの状態を保存するエンドポイント (修正)
app.post('/api/setlist/save', async (req, res) => {
  try {
    const shareId = uuidv4();
    const setlist = new Setlist({ shareId: shareId, state: req.body });
    await setlist.save();
    res.json({ message: 'Setlist state saved successfully.', shareId: shareId });
  } catch (error) {
    console.error('Failed to save setlist state:', error);
    res.status(500).json({ message: 'Failed to save setlist state.', error: error.message });
  }
});

// セットリストの状態を取得するエンドポイント (修正)
app.get('/api/setlist/load', async (req, res) => {
  try {
    const shareId = req.query.id;
    const setlist = await Setlist.findOne({ shareId: shareId });
    if (setlist) {
      res.json(setlist.state);
    } else {
      res.status(404).json({ message: 'Setlist not found.' });
    }
  } catch (error) {
    console.error('Failed to load setlist state:', error);
    res.status(500).json({ message: 'Failed to load setlist state.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});