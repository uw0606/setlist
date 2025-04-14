const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.listen(PORT, console.log("server running"));

// 環境変数から MongoDB 接続文字列を取得
// const mongoUri = process.env.MONGODB_URI;
// if (typeof mongoUri !== 'string' || mongoUri.trim() === '') {
//   console.error('MONGODB_URI environment variable is not set or is empty.');
//   process.exit(1);
// }

// MongoDB 接続
mongoose.connect("mongodb+srv://uw0606:uw06068510@cluster0.u3dmf9u.mongodb.net/setlist?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// セットリストのスキーマ
const setlistSchema = new mongoose.Schema({
  shareId: String,
  state: Object,
});

const Setlist = mongoose.model('Setlist', setlistSchema);

app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// セットリストの状態を保存するエンドポイント
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

// セットリストの状態を取得するエンドポイント
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
