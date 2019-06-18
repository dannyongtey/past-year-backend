import express from 'express';
import controllers from '../controllers'
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('Hello World!')
});

router.post('/search', controllers.SearchController)

export default router;
