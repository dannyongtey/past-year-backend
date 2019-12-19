import express from 'express';
import controllers from '../controllers'
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('Hello World!')
});

router.post('/search', controllers.SearchController)
router.get('/meta', controllers.FileListController)
router.get('/download/:id', controllers.NewSingleDownloadController)
router.post('/download/single', controllers.MultipleSingleDownloadController)
router.post('/download/multiple', controllers.MultipleDownloadController)
router.post('/download/shared', controllers.SendFilesViaDownloadID)

export default router;
