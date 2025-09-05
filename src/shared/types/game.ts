export type GameInitResponse = {
  type: 'game_init';
  postId: string;
  username: string;
  seed: string;
  words: string[];
};

