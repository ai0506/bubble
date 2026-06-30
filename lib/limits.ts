export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 12;
export const USER_MESSAGE_MAX_LENGTH = 300;

export function isNicknameLengthValid(value: string) {
  const length = value.trim().length;
  return length >= NICKNAME_MIN_LENGTH && length <= NICKNAME_MAX_LENGTH;
}

export function isUserMessageLengthValid(value: string) {
  return value.trim().length <= USER_MESSAGE_MAX_LENGTH;
}
