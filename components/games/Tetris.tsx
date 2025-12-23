'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// 테트로미노 정의
const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00f0f0',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#f0f000',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#a000f0',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#00f000',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#f00000',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#0000f0',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#f0a000',
  },
};

type TetrominoType = keyof typeof TETROMINOS;

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;

interface Position {
  x: number;
  y: number;
}

interface Piece {
  type: TetrominoType;
  shape: number[][];
  position: Position;
  color: string;
}

// 빈 보드 생성
const createEmptyBoard = (): (string | null)[][] =>
  Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null)
  );

// 랜덤 테트로미노 선택
const getRandomTetromino = (): TetrominoType => {
  const types = Object.keys(TETROMINOS) as TetrominoType[];
  return types[Math.floor(Math.random() * types.length)];
};

// 새 피스 생성
const createPiece = (type: TetrominoType): Piece => ({
  type,
  shape: TETROMINOS[type].shape.map((row) => [...row]),
  position: { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 },
  color: TETROMINOS[type].color,
});

// 피스 회전
const rotatePiece = (shape: number[][]): number[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = [];
  for (let i = 0; i < cols; i++) {
    rotated[i] = [];
    for (let j = rows - 1; j >= 0; j--) {
      rotated[i].push(shape[j][i]);
    }
  }
  return rotated;
};

// 충돌 감지
const checkCollision = (
  board: (string | null)[][],
  piece: Piece,
  offset: Position = { x: 0, y: 0 }
): boolean => {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = piece.position.x + x + offset.x;
        const newY = piece.position.y + y + offset.y;
        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          (newY >= 0 && board[newY][newX])
        ) {
          return true;
        }
      }
    }
  }
  return false;
};

// 피스를 보드에 병합
const mergePieceToBoard = (
  board: (string | null)[][],
  piece: Piece
): (string | null)[][] => {
  const newBoard = board.map((row) => [...row]);
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.position.y + y;
        const boardX = piece.position.x + x;
        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          newBoard[boardY][boardX] = piece.color;
        }
      }
    }
  }
  return newBoard;
};

// 완성된 라인 제거
const clearLines = (board: (string | null)[][]): { newBoard: (string | null)[][]; linesCleared: number } => {
  let linesCleared = 0;
  const newBoard = board.filter((row) => {
    if (row.every((cell) => cell !== null)) {
      linesCleared++;
      return false;
    }
    return true;
  });

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }

  return { newBoard, linesCleared };
};

// 점수 계산
const calculateScore = (lines: number, level: number): number => {
  const basePoints = [0, 100, 300, 500, 800];
  return basePoints[lines] * (level + 1);
};

export default function Tetris() {
  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<TetrominoType>(getRandomTetromino);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // 새 게임 시작
  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPiece(createPiece(getRandomTetromino()));
    setNextPiece(getRandomTetromino());
    setScore(0);
    setLevel(0);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    setIsStarted(true);
  }, []);

  // 피스 이동
  const movePiece = useCallback(
    (dx: number, dy: number) => {
      if (!currentPiece || gameOver || isPaused) return;

      if (!checkCollision(board, currentPiece, { x: dx, y: dy })) {
        setCurrentPiece((prev) =>
          prev
            ? {
                ...prev,
                position: {
                  x: prev.position.x + dx,
                  y: prev.position.y + dy,
                },
              }
            : null
        );
      } else if (dy > 0) {
        // 아래로 이동 실패 시 피스 고정
        const newBoard = mergePieceToBoard(board, currentPiece);
        const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);

        setBoard(clearedBoard);
        setLines((prev) => {
          const newLines = prev + linesCleared;
          setLevel(Math.floor(newLines / 10));
          return newLines;
        });
        setScore((prev) => prev + calculateScore(linesCleared, level));

        // 새 피스 생성
        const newPiece = createPiece(nextPiece);
        if (checkCollision(clearedBoard, newPiece)) {
          setGameOver(true);
          setCurrentPiece(null);
        } else {
          setCurrentPiece(newPiece);
          setNextPiece(getRandomTetromino());
        }
      }
    },
    [board, currentPiece, gameOver, isPaused, level, nextPiece]
  );

  // 피스 회전
  const rotate = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    const rotatedShape = rotatePiece(currentPiece.shape);
    const rotatedPiece = { ...currentPiece, shape: rotatedShape };

    // 벽 킥 시도
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!checkCollision(board, { ...rotatedPiece, position: { ...rotatedPiece.position, x: rotatedPiece.position.x + kick } })) {
        setCurrentPiece({
          ...rotatedPiece,
          position: { ...rotatedPiece.position, x: rotatedPiece.position.x + kick },
        });
        return;
      }
    }
  }, [board, currentPiece, gameOver, isPaused]);

  // 하드 드롭
  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    let dropDistance = 0;
    while (!checkCollision(board, currentPiece, { x: 0, y: dropDistance + 1 })) {
      dropDistance++;
    }

    const droppedPiece = {
      ...currentPiece,
      position: {
        ...currentPiece.position,
        y: currentPiece.position.y + dropDistance,
      },
    };

    const newBoard = mergePieceToBoard(board, droppedPiece);
    const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);

    setBoard(clearedBoard);
    setScore((prev) => prev + dropDistance * 2 + calculateScore(linesCleared, level));
    setLines((prev) => {
      const newLines = prev + linesCleared;
      setLevel(Math.floor(newLines / 10));
      return newLines;
    });

    const newPiece = createPiece(nextPiece);
    if (checkCollision(clearedBoard, newPiece)) {
      setGameOver(true);
      setCurrentPiece(null);
    } else {
      setCurrentPiece(newPiece);
      setNextPiece(getRandomTetromino());
    }
  }, [board, currentPiece, gameOver, isPaused, level, nextPiece]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStarted || gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsPaused((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStarted, gameOver, movePiece, rotate, hardDrop]);

  // 게임 루프
  useEffect(() => {
    if (!isStarted || gameOver || isPaused) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = Math.max(100, 1000 - level * 100);
    gameLoopRef.current = setInterval(() => {
      movePiece(0, 1);
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isStarted, gameOver, isPaused, level, movePiece]);

  // 보드 + 현재 피스 렌더링
  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);

    // 고스트 피스 (하드 드롭 위치 미리보기)
    if (currentPiece && !gameOver) {
      let ghostY = 0;
      while (!checkCollision(board, currentPiece, { x: 0, y: ghostY + 1 })) {
        ghostY++;
      }

      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = currentPiece.position.y + y + ghostY;
            const boardX = currentPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              if (!displayBoard[boardY][boardX]) {
                displayBoard[boardY][boardX] = currentPiece.color + '40'; // 투명한 고스트
              }
            }
          }
        }
      }

      // 현재 피스
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = currentPiece.position.y + y;
            const boardX = currentPiece.position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color;
            }
          }
        }
      }
    }

    return displayBoard;
  };

  // 다음 피스 미리보기
  const renderNextPiece = () => {
    const tetromino = TETROMINOS[nextPiece];
    return (
      <div className="flex flex-col items-center">
        {tetromino.shape.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => (
              <div
                key={x}
                className="border border-gray-700"
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: cell ? tetromino.color : 'transparent',
                  boxShadow: cell ? `inset 0 0 10px rgba(255,255,255,0.3)` : 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-6 text-cyan-400">TETRIS</h1>

      <div className="flex gap-8">
        {/* 게임 보드 */}
        <div
          className="border-4 border-gray-600 bg-gray-800"
          style={{
            width: BOARD_WIDTH * CELL_SIZE + 8,
            height: BOARD_HEIGHT * CELL_SIZE + 8,
          }}
        >
          <div className="relative">
            {renderBoard().map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => (
                  <div
                    key={x}
                    className="border border-gray-700"
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: cell || '#1a1a2e',
                      boxShadow: cell && !cell.endsWith('40')
                        ? `inset 0 0 10px rgba(255,255,255,0.3), 0 0 5px ${cell}`
                        : 'none',
                      opacity: cell?.endsWith('40') ? 0.3 : 1,
                    }}
                  />
                ))}
              </div>
            ))}

            {/* 일시정지 / 게임오버 오버레이 */}
            {(isPaused || gameOver) && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold mb-4">
                    {gameOver ? 'GAME OVER' : 'PAUSED'}
                  </p>
                  <button
                    onClick={startGame}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold transition-colors"
                  >
                    {gameOver ? 'Play Again' : 'New Game'}
                  </button>
                </div>
              </div>
            )}

            {/* 시작 화면 */}
            {!isStarted && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold mb-4">Press Start to Play</p>
                  <button
                    onClick={startGame}
                    className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold text-xl transition-colors"
                  >
                    START
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 사이드 패널 */}
        <div className="flex flex-col gap-6">
          {/* 점수 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <h3 className="text-sm text-gray-400 mb-1">SCORE</h3>
            <p className="text-2xl font-bold text-cyan-400">{score.toLocaleString()}</p>
          </div>

          {/* 레벨 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <h3 className="text-sm text-gray-400 mb-1">LEVEL</h3>
            <p className="text-2xl font-bold text-green-400">{level}</p>
          </div>

          {/* 라인 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <h3 className="text-sm text-gray-400 mb-1">LINES</h3>
            <p className="text-2xl font-bold text-yellow-400">{lines}</p>
          </div>

          {/* 다음 블록 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
            <h3 className="text-sm text-gray-400 mb-2">NEXT</h3>
            {renderNextPiece()}
          </div>

          {/* 컨트롤 안내 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-600 text-xs">
            <h3 className="text-sm text-gray-400 mb-2">CONTROLS</h3>
            <div className="space-y-1 text-gray-300">
              <p>← → : Move</p>
              <p>↑ : Rotate</p>
              <p>↓ : Soft Drop</p>
              <p>Space : Hard Drop</p>
              <p>P : Pause</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
