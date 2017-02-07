//var mongojs = require("mongojs");
var db = null;//mongojs('localhost:27017/myGame', ['account','progress']);

var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/Index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var SOCKET_LIST = {};

var WIDTH = 1900*3;
var HEIGHT = 900*3;

var Entity = function(param){
	var self = {
		x:0,
		y:0,
		maxSpd:10,
		spdX:0,
		spdY:0,
		id:Math.random(),
		currentOrder:null
	}
	self.xDone = false;
	self.yDone = false;
	if(param){
		if(param.x)
			self.x = param.x;
		if(param.y)
			self.y = param.y;
		if(param.id)
			self.id = param.id;		
	}
	
	self.update = function(){
		self.updateSpeed();
		self.updatePosition();
	}
	self.addOrder = function(pack){ //TODO: ma dodawać order do kolejki orderow
		self.currentOrder = pack;
		//inne rzeczy ktore zrobi order
	}
	self.updateSpeed = function(){ //pack = {x:,y:,maxSpd:}
		//kod ktory uruchomii sie nawet bez paczki
		var pack = self.currentOrder;
		var spd = null;
		
		if(!pack){
			return;
		}
			console.log('Order' + ': ' + self.id);
		//kod ktory uruchomii sie tylko jak jest paczka
		
		if (self.x!=pack.x && self.y!=pack.y)
			spd=0.7*self.maxSpd; //dodać pack.maxSpd
		else
			spd=self.maxSpd;    

		if (self.x!=pack.x)
		{   
    if(Math.abs(self.x-pack.x)<=spd){
        self.x=pack.x; //nieladnie tutaj zrobione, kiedys trzeba bedzie poprawic
		self.spdX = 0;
		self.xDone = true;
		console.log('Doskok x' + ': ' + self.id);
    }else{
		console.log('Przesuwanie x' + ': ' + self.id);
        if(self.x<pack.x)
            self.spdX=spd;
        else
            self.spdX=-spd;
        }
		}

		if (self.y!=pack.y)
		{   
    if(Math.abs(self.y-pack.y)<=spd){
        self.y=pack.y; //nieladnie tutaj zrobione, kiedys trzeba bedzie poprawic
		self.spdY = 0;
		self.yDone = true;
		console.log('Doskok y' + ': ' + self.id);
	}else{
		console.log('Przesuwanie y' + ': ' + self.id);
        if(self.y<pack.y)
           self.spdY=spd;
        else
           self.spdY=-spd;
	}
		}
			if(self.xDone&&self.yDone){
				self.currentOrder = null;
				console.log('Order: nulled');
				self.xDone = false;
				self.yDone = false;
			}
	}
	
	self.updatePosition = function(){
		if((!(self.x<0&&self.spdX<0))&&(!(self.x>WIDTH&&self.spdX>0)))
		self.x += self.spdX;
		if((!(self.y<0&&self.spdY<0))&&(!(self.y>HEIGHT&&self.spdY>0)))
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}

return self;
}

var Object =  function(param){
	var self = Entity(param);
	
	
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,	
	};}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		}	
	}
	
	Object.list[self.id] = self;
	
	initPack.object.push(self.getInitPack());
	
	return self;
}
Object.list = {};

Object.update = function(){
	var pack = [];
	for(var i in Object.list){
		var object = Object.list[i];
		object.update();
		if(object.toRemove){
			delete Object.list[i];
			removePack.object.push(object.id);
		} else
			pack.push(object.getUpdatePack());		
	}
	return pack;
}

Object.getAllInitPack = function(){
	var objects = [];
	for(var i in Object.list)
		objects.push(Object.list[i].getInitPack());
	return objects;
}

var Player = function(param){
	var self = Entity(param);
	self.username = param.username;
	
	var super_update = self.update;
	self.update = function(){
		super_update();
	}

	Player.list[self.id] = self;

	return self;
}
Player.list = {};
Player.onConnect = function(socket,username){
	var player = Player({
		username:username,
		id:socket.id,
	});
	var object = {};
	for(var i = 0;i<10;i++)
		object[i] = Object({x:i*50,y:i*25});

	socket.on('sendMsgToServer',function(data){
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',player.username + ': ' + data);
		}
	});
	
	socket.on('sendPmToServer',function(data){ //data:{username,message}
		var recipientSocket = null;
		for(var i in Player.list)
			if(Player.list[i].username === data.username)
				recipientSocket = SOCKET_LIST[i];
		if(recipientSocket === null){
			socket.emit('addToChat','The player ' + data.username + ' is not online.');
		} else {
			recipientSocket.emit('addToChat','From ' + player.username + ':' + data.message);
			socket.emit('addToChat','To ' + data.username + ':' + data.message);
		}
	});
	
	socket.on('addOrders',function(data){
		for(var i in data.objects){
			Object.list[data.objects[i]].addOrder(data.order);
		}
	});
	
	socket.emit('init',{
		selfId:socket.id,
		object:Object.getAllInitPack()
	})
	for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat','Player '+player.username+' connected.');
		}
}

Player.onDisconnect = function(socket){
	for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat','Player '+Player.list[socket.id].username+' disconnected. ');
		}
	delete Player.list[socket.id];
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();	
	}
	return pack;
}

var DEBUG = true;

var isValidPassword = function(data,cb){
	return cb(true);
	/*db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});*/
}
var isUsernameTaken = function(data,cb){
	return cb(false);
	/*db.account.find({username:data.username},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});*/
}
var addUser = function(data,cb){
	return cb();
	/*db.account.insert({username:data.username,password:data.password},function(err){
		cb();
	});*/
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	socket.on('signIn',function(data){ //{username,password}
		isValidPassword(data,function(res){
			if(res){
				Player.onConnect(socket,data.username);
				socket.emit('signInResponse',{success:true});
			} else {
				socket.emit('signInResponse',{success:false});			
			}
		});
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){
			if(res){
				socket.emit('signUpResponse',{success:false});		
			} else {
				addUser(data,function(){
					socket.emit('signUpResponse',{success:true});					
				});
			}
		});		
	});
	
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);		
	});
	
	
	
});

var initPack = {object:[]};
var removePack = {object:[]};


setInterval(function(){
	var pack = {
		object:Object.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
	}
	initPack.object = [];
	removePack.object = [];
	
},1000/25);







