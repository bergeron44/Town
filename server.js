const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

const games = {};
const roles = ['Killer', 'Doctor', 'Detective', 'Lawyer', 'Policeman', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen'];

function generateGameCode() {
  const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log(`Generated game code: ${gameCode}`);
  return gameCode;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  console.log(`Shuffled array: ${array}`);
  return array;
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

socket.on('createGame', (hostName) => {
    console.log(`Creating game with host: ${hostName}`);
    const gameCode = generateGameCode();
    games[gameCode] = {
      host: socket.id,
      creator: hostName,
      players: [{ id: socket.id, name: hostName, isAlive: true }],
      votes: {},
      rollAsigned: false,
      status: 'lobby',
      roles: [...roles],
      currentPhase: 'waiting',
      currentTurn: null,
      killerChoice: null,
      doctorChoice: null,
      detectiveChoice: null,
      policemanChoice: null,
      mutedPlayer: null,
      killerId: null,
      doctorId: null,
      detectiveId: null,
      policemanId: null,
      lawyerId: null,
    };
    socket.join(gameCode);
    socket.emit('gameCreated', { gameCode, players: games[gameCode].players });
    console.log(`Game created: ${gameCode}`);
  });

  socket.on('joinGame', ({ gameCode, playerName }) => {
    console.log(`Player ${playerName} trying to join game: ${gameCode}`);
    const game = games[gameCode];

    if (game && (game.status === 'lobby'||game.status === 'readyToStart')) {
      const nameExists = game.players.some(player => player.name === playerName);
  
      if (nameExists) {
        socket.emit('joinError', 'Player name already exists in this game');
        console.log(`Join error: Player name ${playerName} already exists in game ${gameCode}`);
        return;
      }

      const newPlayer = { id: socket.id, name: playerName, isAlive: true };
      game.players.push(newPlayer);
      socket.join(gameCode);

      io.to(gameCode).emit('playerJoined', { players: game.players });
      console.log(`Player ${playerName} joined game: ${gameCode}`);

      if (game.players.length >= 6) {
        game.status = 'readyToStart';
      }
    } else {
      socket.emit('joinError', 'Game not found or already started');
      console.log(`Join error for player ${playerName}: Game not found or already started`);
    }
  });

  socket.on('startGame', (gameCode, creatorAprove) => {
    console.log(`Starting game: ${gameCode} by host: ${socket.id}`);
    const game = games[gameCode];
    console.log("in startGame before role assign");
    console.log(game.rollAsigned);

    if (game && game.status==='readyToStart' && creatorAprove === 'true') {
      game.status = 'killerTurn';
      game.rollAsigned = true;
      const specialRoles = ['Killer', 'Doctor', 'Detective', 'Policeman', 'Lawyer'];
      const shuffledRoles = shuffleArray(specialRoles.slice(0, Math.min(game.players.length, specialRoles.length)));
      const shuffledPlayers = shuffleArray(game.players);

      shuffledPlayers.forEach((player, index) => {
        let role;
        if (index < shuffledRoles.length) {
          role = shuffledRoles[index];
        } else {
          role = 'Citizen';
        }
        switch (role) {
          case 'Killer':
            game.killerId = player.id;
            break;
          case 'Doctor':
            game.doctorId = player.id;
            break;
          case 'Detective':
            game.detectiveId = player.id;
            break;
          case 'Policeman':
            game.policemanId = player.id;
            break;
          case 'Lawyer':
            game.lawyerId = player.id;
            break;
        }
        console.log(`Assigned role ${role} to player ${player.name}`);
        io.to(player.id).emit('gameStarted', { players: game.players,role:role,gameCode:gameCode });
      });

      console.log(`Killer ID: ${game.killerId}`);
      console.log(`Doctor ID: ${game.doctorId}`);
      console.log(`Detective ID: ${game.detectiveId}`);
      console.log(`Policeman ID: ${game.policemanId}`);
      console.log(`Lawyer ID: ${game.lawyerId}`);
    } else if (game && game.players.length < 6) {
      socket.emit('startError', 'Not enough players to start the game');
      console.log(`Start error for game ${gameCode}: Not enough players`);
    }
  });

  socket.on('killerAction', ({ gameCode, role }) => {
    console.log(`Received killer turn for game ${gameCode} from player ${socket.id}`);
    const game = games[gameCode];

    if (role === 'Killer' && socket.id === game.killerId) {
      console.log(`Game ${gameCode} is in 'playing' state. Starting Killer's turn for player ${game.killerId}`);
      game.currentPhase = 'night';
      game.status = 'killerTurn';
      io.to(game.killerId).emit('killerTurn');
    } else {
      console.log(`Invalid killer turn attempt from player ${socket.id} in game ${gameCode}, and game killer id is: ${game.killerId}`);
    }
  });

  socket.on('roleAction', ({ gameCode, targetId, role }) => {
    console.log(`you are in role action for :`);
    console.log(role);
    console.log("target this man :");
    console.log(targetId);
    console.log("in game :");
    console.log(gameCode);
    const game = games[gameCode];

    switch (role) {
      case 'Killer':
        console.log("this the man try id:");
        console.log(socket.id);
        console.log("this the start kiler  id:");
        console.log(game.killerId);
          game.killerChoice = targetId;
          game.currentTurn = 'Doctor';
          io.to(game.doctorId).emit('doctorTurn');
          console.log('Killer action processed, moving to Doctor\'s turn');
        
        break;

      case 'Doctor':
        console.log("this the man try id:");
        console.log(socket.id);
        console.log("this the start doctor  id:");
        console.log(game.doctorId);
        game.doctorChoice = targetId;
        game.currentTurn = 'Detective';
        io.to(game.detectiveId).emit('detectiveTurn');
        console.log('Doctor action processed, moving to Detective\'s turn');
        
        break;

      case 'Detective':
        console.log("this the man try id:");
        console.log(socket.id);
        console.log("this the start detective  id:");
        console.log(game.detectiveId);
        game.detectiveChoice = targetId;
        const isKiller = targetId === game.killerId;
        io.to(game.detectiveId).emit('detectiveResult', { isKiller });
        game.currentTurn = 'Policeman';
        io.to(game.policemanId).emit('policemanTurn');
        console.log('Detective action processed, moving to Policeman\'s turn');
        break;

      case 'Policeman':
         console.log("this the man try id:");
         console.log(socket.id);
         console.log("this the start Policeman  id:");
         console.log(game.policemanId);
          game.policemanChoice = targetId;
          game.currentTurn = 'Lawyer';
          io.to(game.lawyerId).emit('lawyerTurn');
          console.log('Policeman action processed, moving to Lawyer\'s turn');
        
        break;

      case 'Lawyer':
         console.log("this the man try id:");
         console.log(socket.id);
         console.log("this the start lawyer  id:");
         console.log(game.lawyerId);
          const killerTarget = game.killerChoice;
          const doctorTarget = game.doctorChoice;
          const policemanTarget = game.policemanChoice;
          const lawyerTarget = targetId;

          let eliminatedPlayer = null;
          
          if (killerTarget !== doctorTarget) {
            console.log('The killer kill :');
            console.log(killerTarget);
            const eliminatedPlayer = game.players.find(player => player.id === killerTarget);
            // Remove the player from the players array
            if (eliminatedPlayer) {
              game.players = game.players.filter(player => player.id !== eliminatedPlayer.id);
              io.to(killerTarget).emit('die'); // Send "die" message to the eliminated player
            }
          } else {
            console.log('The Doctor saved the Killer\'s target!');
          }
          
          if (policemanTarget === lawyerTarget) {
            game.mutedPlayer = null;
            console.log('Lawyer saved Policeman\'s target from being muted.');
          } else {
            game.mutedPlayer = policemanTarget;
            console.log('Policeman\'s target is muted for the next turn.');
          }
          if (game.players.length <= 3) {
            // If there are 3 or fewer players, send a message to everyone that the killer wins
            game.players.forEach(player => {
              io.to(player.id).emit('killerWon');
            });
          
            console.log('Game over: Killer wins.');
          } else {
            // Normal game flow if there are more than 3 players
            game.players.forEach(player => {
              // If the player is the muted player
              if (player.id === game.mutedPlayer) {
                io.to(player.id).emit('muted'); // Send "muted" message to the muted player
              } 
              // For all other players, send vote info with the name of the killed player
              else {
                io.to(player.id).emit('vote', { eliminatedPlayerName: eliminatedPlayer });
              }
            });
          
          }
        
          
          console.log('Night actions processed, moving to voting phase.');
        
        break;
    }
  });
  socket.on('vote', ({ votedPlayer, gameCode }) => {
    const game = games[gameCode];
  
    // Initialize votes if not already done
    if (!game.votes) {
      game.votes = {};
    }
  
    // Increment the vote count for the voted player
    if (!game.votes[votedPlayer]) {
      game.votes[votedPlayer] = 1;
    } else {
      game.votes[votedPlayer]++;
    }
  
    console.log(`${socket.id} voted for ${votedPlayer}`);
    console.log("this man was muted")
    console.log(game.mutedPlayer)
    // Check if the number of votes is equal to the number of players
    var muted=0;
    if(game.mutedPlayer)
      muted=1;

    if (Object.keys(game.votes).length === game.players.length-muted) {
      // Find the player with the most votes
      const [votedOutPlayer, voteCount] = Object.entries(game.votes).reduce((a, b) => (b[1] > a[1] ? b : a)); 
  
      // Remove the voted-out player from the players list
      game.players = game.players.filter(player => player.name !== votedOutPlayer);
  
      // Determine the role of the voted-out player
      const votedOutRole = game.roles[votedOutPlayer];
  
      if (votedOutRole === 'Killer') {
        // Notify all players that the Killer was voted out
        io.to(gameCode).emit('playersWon');
        console.log('Killer was voted out. Game over, citizens won!');
      } else {
        // Notify each player of their specific role
        game.players.forEach(player => {
          let role = 'Citizen'; // Default to Citizen
      
          // Determine role based on player IDs
          if (player.id === game.killerId) {
            role = 'Killer';
          } else if (player.id === game.doctorId) {
            role = 'Doctor';
          } else if (player.id === game.detectiveId) {
            role = 'Detective';
          } else if (player.id === game.policemanId) {
            role = 'Policeman';
          } else if (player.id === game.lawyerId) {
            role = 'Lawyer';
          }
      
          // Emit game resume with the specific role
          io.to(player.id).emit('gameResume', {
            players: game.players,
            role:role, // Send the specific role to the player
            gameCode:gameCode,
          });
          console.log(`Sent role ${role} to player ${player.name}`);
        });
        
        console.log(`Player ${votedOutPlayer} was voted out. Game resumes.`);
      }
  
      // Reset the votes for the next round
      game.votes = {};
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    Object.keys(games).forEach(gameCode => {
      const game = games[gameCode];
      game.players = game.players.filter(player => player.id !== socket.id);
      io.to(gameCode).emit('playerLeft', { players: game.players });
      console.log(`Player left game: ${gameCode}`);
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
