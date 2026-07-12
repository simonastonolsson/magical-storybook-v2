export type UserModel = {
  id: string;
  user_id: string;
  model_path: string;
  model_name: string;
  trigger_word: string;
  char_desc: string | null;
  reference_image_url: string | null;
  reference_image_urls: string[] | null;
  created_at: string;
};

export type NewUserModel = {
  model_name: string;
  reference_image_urls: string[];
  char_desc?: string | null;
};
