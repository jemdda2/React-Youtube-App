const express = require('express');
const router = express.Router();
const { Video } = require("../models/Video");
const { Subscriber } = require("../models/Subscriber");
const { auth } = require("../middleware/auth");
const multer = require("multer");
var ffmpeg = require("fluent-ffmpeg");

let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        if (ext !== '.mp4') {
            return cb(res.status(400).end('only mp4 is allowed'), false);
        }
        cb(null, true)
    }
});

const upload = multer({ storage: storage }).single("file");

//=================================
//             Video
//=================================

router.post('/uploadfiles', (req, res) => {

    // ビデオをサーバーに保存
    upload(req, res, err => {
        if(err) return res.json({ success: false, err })
        return res.json({ success: true, url: res.req.file.path, fileName: res.req.file.filename })
    })
})

router.post('/getVideoDetail', (req, res) => {

    // ビデオDetail情報を取得
    Video.findOne({ "_id" : req.body.videoId })
        .populate('writer')  // populateを使うとwriterのすべでの情報を取得
        .exec((err, videoDetail) => {
            if(err) return res.status(400).send(err)
            return res.status(200).json({ success: true, videoDetail })
        })
})

router.post('/uploadVideo', (req, res) => {

    // ビデオ情報をDBへ保存
    const video = new Video(req.body);

    video.save((err, doc) => {
        if(err) return res.json({ success: false, err })
        return res.status(200).json({ success: true })
    })
})

router.get('/getVideos', (req, res) => {

    // 全てのビデオ情報をDBから取得し、LandingPageへ表示
    Video.find()
        .populate('writer')
        .exec((err, videos) => {
            if(err) return res.status(400).send(err);
            return res.status(200).json({ success: true, videos })
        })
})

router.post('/getSubscriptionVideos', (req, res) => {

    // ログインユーザーがチャンネル登録したユーザー情報をDBから取得し、SubscriptionPageへ表示
    // Need to find all of the Users that I am subscribing to From Subscriber Collection 
    Subscriber.find({ userFrom: req.body.userFrom })
        .exec((err, subscriberInfo) => {
            if(err) return res.status(400).send(err);

            // チャンネル登録したユーザー情報をArrayへ
            let subscribedUser = [];
            subscriberInfo.map((subscriber, i) => {
                subscribedUser.push(subscriber.userTo);
            })

            // Need to Fetch all of the Videos that belong to the Users that I found in previous step. 
            Video.find({ writer: { $in: subscribedUser }})
                .populate('writer')
                .exec((err, videos) => {
                    if(err) return res.status(400).send(err);
                    return res.status(200).json({ success: true, videos })
                })
        })
})




router.post('/thumbnail', (req, res) => {

    let thumbsFilePath = "";
    let fileDuration = "";

    // ローカルにffmpegのinstallが必要
    // ビデオ情報を取得
    ffmpeg.ffprobe(req.body.url, function(err, metadata) {
        // all matadata
        console.dir(metadata);
        console.log('metadata', metadata.format.duration);

        fileDuration = metadata.format.duration;
    })

    // thumbnailを作成
    ffmpeg(req.body.url)
    .on('filenames', function(filenames) {
        console.log('Will generate ' + filenames.join(', '));
        thumbsFilePath = "uploads/thumbnails/" + filenames[0];
    })
    .on('end', function() {
        console.log('Screenshots taken');
        return res.json({ success: true, thumbsFilePath: thumbsFilePath, fileDuration: fileDuration })
        
    })
    .on('error', function(err) {
        console.error(err);
        return res.json({ success: false, err })
    })
    .screenshots({
        // Will take screenshots at 20%, 40%, 60% and 80% of the video
        count: 3,
        folder: 'uploads/thumbnails',
        size: '320x240',
        // '%b': input basename (filename w/o extension)
        filename: 'thumbnail-%b.png'
    })
})


module.exports = router;
