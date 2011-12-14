var express = require('express'),
    app = express.createServer(),
    oauth = new (require('oauth').OAuth)(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      'pa6CKYWmoYVSCR4HGWiXA',
      'fhdSlgkVQ9WnqPB1ZbsW6YOe82jPS7b6QY6cer6qWo',
      '1.0',
      'http://localhost:3000/auth/twitter/callback',
      'HMAC-SHA1'
    ),
    url = require('url'),
    http = require('http'),
    io = require('socket.io').listen(3080),
    store = new (require('connect').session.MemoryStore)(),
    parseCookie = require('connect').utils.parseCookie,
    user_dict = {},
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/twitrelation');

var User = new Schema({
  id: String,
  screen_name: String,
  img: String,
  following: [String],
  last_up_date: Date
});

mongoose.model('User', User);
User = mongoose.model('User');

var Relation = new Schema({
  to: String,
  from: String,
  score: Number
});

mongoose.model('Relation', Relation);
Relation = mongoose.model('Relation');

app.configure(function () {
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.static(__dirname + '/public'));
  app.use(express.session({
    store: store,
    secret: "secret",
    cookie: {httpOnly: false}
  }));
  app.set('view engine', 'ejs');
});

app.dynamicHelpers({
  session: function (req, res) {
    return req.session;
  }
});

app.get('/', function (req, res) {
    res.render('index', {layout: false});
});

/****oauth関連ここから****/
app.get('/auth/twitter', function (req, res) {
  oauth.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results){
    if (error) {
      res.send(error);
    }
    else {
      req.session.oauth = {};
      req.session.oauth.token = oauth_token;
      req.session.oauth.token_secret = oauth_token_secret;
      res.redirect('http://twitter.com/oauth/authenticate?oauth_token=' + oauth_token);
    }
  });
});

app.get('/auth/twitter/callback', function (req, res) {
  if (req.session.oauth) {
    req.session.oauth.verifier = req.query.oauth_verifier;
    oauth.getOAuthAccessToken(req.session.oauth.token, req.session.oauth.token_secret, req.session.oauth.verifier,
      function (error, oauth_access_token, oauth_access_token_secret, results) {
        if (error) {
          res.send(error);
        }
        else {
          req.session.oauth.access_token = oauth_access_token;
          req.session.oauth.access_token_secret = oauth_access_token_secret;
          req.session.user_profile = results;
          if (!user_dict[req.session.user_profile.id]) {
            user_dict[req.session.user_profile.id] = {};
          }
          user_dict[req.session.user_profile.id].img = req.session.user_profile.image_url;
          console.log("***IMG*** " + req.session.user_profile.profile_image_url);

          var oa = req.session.oauth;
          var id = req.session.user_profile.id;

          function analysis_mention(err, data) {
            var json = JSON.parse(data);
            var mentions = {};
            for (var i = 0; i < json.length; i ++) {
              var entry = json[i];
              var uid = entry["in_reply_to_user_id"];
              if (!uid) {
                continue;
              }
              if (!mentions[uid]) {
                mentions[uid] = new Relation({score: 0});
              }
              mentions[uid].to = uid;
              mentions[uid].from = results.id;
              mentions[uid].score = mentions[uid].score + 1;
            }
            show_results("mention analysis finished", id);
            for (var uid in mentions) {
              if (uid === 'img') {
                continue;
              }
              if (mentions[uid].score === 0) {
                continue;
              }
              /*
              oauth.get("http://api.twitter.com/1/users/show.json?user_id=" + uid,
                  oa.access_token,
                  oa.access_token_secret,
                  analysis_user);*/
              mentions[uid].save();
            }
            res.redirect('/');
          }

          function analysis_following(err, data) {
            var json = JSON.parse(data);
            var ids = json.ids;
            for (var i in ids) {
              me.following.push(ids[i]);
            }
            me.save();

            oauth.get("http://api.twitter.com/1/statuses/user_timeline.json?count=200", 
                oa.access_token,
                oa.access_token_secret, 
                analysis_mention);
          }

          function analysis() {
            console.log("analysis");
            oauth.get("http://api.twitter.com/1/friends/ids.json", 
                oa.access_token,
                oa.access_token_secret, 
                analysis_following);
          }

          // 画像をゲットしてそれのcallbackにすること
          var me = new User({
              id: results.id,
              screen_name: results.screen_name,
              img: "",
              last_up_date: Date.now()
          });
          analysis();
        }
    });
  }
});
/****oauth ここまで****/

app.get('signout', function (req, res) {
  delete req.session.oauth;
  delete req.session.user_profile;
  res.redirect('/');
});

app.listen(3000);


function show_results(title, id) {
  console.log("---" + title + "---");
  console.log(user_dict[id]);
  console.log("-------------------------------------");
}



io.sockets.on('connection', function (socket) {
  var sid;
  var session;
  socket.on('cookie', function (data) {
    var cookie = data.cookie;
    sid = parseCookie(cookie)['connect.sid'];
  });

  function sendData(uid) {
    var id = session.user_profile.id;
    socket.emit("user", JSON.stringify({
        img: user_dict[uid].img,
        data: user_dict[id][uid]
    }));
  }

  socket.on('analysis', function(data) {
    if (!session) {
      var cookie = data.cookie,
          sid = parseCookie(cookie)['connect.sid'];
      store.get(sid, function (err, s) {
        session = s; analysis(data, s);
      });
    }
    else {
      analysis(data, session);
    }
  });

});
