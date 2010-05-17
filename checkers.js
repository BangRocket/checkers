// TODO add change sites, add communication

function Checkers(board) {

  var self = this; // reference helper  
  // events constants
  this.EVENT_DATA_RECEIVED = "dataReceivedEvent";
  this.BOARD_SIZE = 8;
  this.TURNS = ["white", "black"];

  this.$board = $("#" + board); // game board
  this.currentChecker = null;
  this.currentTurn = self.TURNS[0];

  // pub/sub utils
  var PubSubUtils = {
    subs: [],

    subscribe: function (event, action) {
      if (this.subs[event] == undefined) {
        this.subs[event] = [];
      }
      this.subs[event].push(action);
    },

    publish: function (event, params) {
      var self = this;
      $.each(this.subs[event], function (index, action) {
        self.subs[event][index](params);
      });
    }
  };

  // socket utils
  var SocketUtils = {
    socket: null,

    connect: function (callback) {
      io.setPath('/client/');
      socket = new io.Socket('localhost', {
        rememberTransport: false,
        port: 8080
      });
      socket.connect();
      socket.addEvent('message', function (data) {
        var obj = JSON.parse(data);
        PubSubUtils.publish(self.EVENT_DATA_RECEIVED, obj);
      });
    },

    send: function (message) {
      socket.send(message);
    }
  };

  // Square constructor

  function Square(x, y) {
    var self = this;

    this.COLORS = {
      "true": "square_black",
      "false": "square_white"
    };
    this.id = "square_" + x + "_" + y;
    this.color = self.COLORS[x % 2 === y % 2];
    this.x = x;
    this.y = y;
    this.position = {
      "x": self.x,
      "y": self.y
    };
    this.checker = null; // checker
    // set jquery object
    this.$square = $('<div id="' + self.id + '" class="square ' + self.color + '"> </div>').data("square", self);

    // checks if square is empty
    this.isEmpty = function () {
      return self.checker == null;
    }

    // removes checker from the square
    this.removeChecker = function () {
      self.checker = null;
    }

    // associates checker with the square
    this.hasOne = function (checker) {
      self.checker = checker;
    }

    this.highlight = function () {
      self.$square.addClass('square_highlighted');
    }

    this.unHighlight = function () {
      self.$square.removeClass('square_highlighted');
    }

    this.isHighlighted = function () {
      return self.$square.hasClass('square_highlighted');
    }

    this.getPosition = function () {
      return {
        "x": self.x,
        "y": self.y
      };
    }

    // TODO: add queen/remove
    this.getPossibleMoves = function () {
      var moves = [];
      var positions = getMovesPositions();
      if (self.checker.isBlack()) {
        moves.push(positions.br);
        moves.push(positions.tr);
      }
      else {
        moves.push(positions.tl);
        moves.push(positions.bl);
      }
      return moves;
    }

    // private

    function getMovesPositions() {
      return {
        'br': {
          'x': self.x + 1,
          'y': self.y + 1
        },
        'bl': {
          'x': self.x - 1,
          'y': self.y + 1
        },
        'tr': {
          'x': self.x + 1,
          'y': self.y - 1
        },
        'tl': {
          'x': self.x - 1,
          'y': self.y - 1
        }
      };
    }
  }

  // Checker constructor

  function Checker(x, y) {
    var self = this;

    this.COLORS = {
      "true": "black",
      "false": "white"
    };
    // TODO fix it
    this.color = self.COLORS[x < 2];
    this.square = null; // square object the checker belongs to
    // create jquery object
    this.$checker = $('<div class="checker ' + self.color + '"></div>').data("checker", self)

    // public
    this.belongsTo = function (square) {
      self.square = square;
      // wires up jquery object
      self.$checker.appendTo(square.$square);
    }

    this.isBlack = function () {
      return self.color == "black";
    }

    this.isWhite = function () {
      return self.color == "white";
    }

    this.isActiveTurn = function (turn) {
      return self.color == turn;
    }

    this.getPosition = function () {
      return self.square.getPosition();
    }

    // checkes if selected checker can move
    this.isMovePossible = function (currentChecker, currentTurn) {
      if (self.isActiveTurn(currentTurn) && (currentChecker == null || currentChecker != self)) {
        return true;
      }
      return false;
    }

    // makes move
    this.makeMove = function (square) {
      self.x = square.x;
      self.y = square.y;
      // remove checker from current square
      self.square.removeChecker();
      // set link between square and checker
      self.belongsTo(square);
      square.hasOne(self);
    }
  }

  // private
  // draws game grid

  function drawGrid() {
    for (var i = 0; i < self.BOARD_SIZE; i++) {
      for (var j = 0; j < self.BOARD_SIZE; j++) {
        var square = new Square(i, j);
        square.$square.appendTo(self.$board);
        drawChecker(square);
      }
    }
  }

  // draws checker on the grid

  function drawChecker(square) {
    if (square.y % 2 === square.x % 2 && (square.x < 2 || square.x > 5)) {
      var checker = new Checker(square.x, square.y);
      // wired up checker with square
      checker.belongsTo(square);
      square.hasOne(checker);
    }
  }

  // shows possible moves

  function showPossibleMoves($checker) {
    var square = $checker.data("checker").square;
    var moves = square.getPossibleMoves();

    $.each(moves, function (i, v) {
      var s = getSquare(v);
      if (s != null && s.isEmpty()) {
        s.highlight();
      }
    });
  }

  function setNextTurn() {
    self.currentTurn = (self.currentTurn == self.TURNS[0]) ? self.TURNS[1] : self.TURNS[0];
  }

  var processData = function (obj) {

    if (obj != undefined && obj.message != undefined) {

      var square = getSquare(obj.message[1].n);
      var checker = getChecker(obj.message[1].o);

      checker.makeMove(square);
      setNextTurn();
    }
  }

  // register events
  // TODO use publish / subcribe
  $('.checker').live("mouseover", function () {
    var checker = $(this).data("checker");
    if (self.currentChecker == null && checker.isActiveTurn(self.currentTurn)) {
      showPossibleMoves($(this));
    }
  });

  $('.checker').live("mouseout", function () {
    if (self.currentChecker == null) {
      $('.square').removeClass('square_highlighted');
    }
  });

  $('.checker').live("click", function (e) {
    var checker = $(this).data("checker");
    if (checker.isMovePossible(self.currentChecker, self.currentTurn)) {
      $('.square').removeClass('square_highlighted');
      checker.square.highlight();
      showPossibleMoves($(this));
      self.currentChecker = checker;
    }
    else {
      self.currentChecker = null;
      checker.square.unHighlight();
    }
    return false; // stop bubbling
  });

  $('.square').live("click", function () {
    var square = $(this).data('square');
    if (self.currentChecker != null && square.isHighlighted()) {
      // message
      var m = {
        "n": square.getPosition(),
        "o": self.currentChecker.getPosition()
      };

      SocketUtils.send(m);
      self.currentChecker.makeMove(square);
      setNextTurn();
      self.currentChecker = null;
      $('.square').removeClass('square_highlighted');
    }
  });

  // helpers

  function getSquare(position) {
    return $("#square_" + position.x + "_" + position.y).data('square');
  }

  function getChecker(position) {
    return getSquare(position).checker;
  }

  drawGrid();
  // subscribe elements 
  PubSubUtils.subscribe(self.EVENT_DATA_RECEIVED, processData);
  SocketUtils.connect(processData);
}

Checkers.init = function (board) {
  window.checkers = new Checkers(board);
}
