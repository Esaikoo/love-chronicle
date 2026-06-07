declare module "jsmediatags/dist/jsmediatags.min.js" {
  type Picture = { data: number[]; format: string };
  type Tags = { title?: string; artist?: string; picture?: Picture };
  type Result = { tags: Tags };

  class Reader {
    constructor(file: Blob);
    read(callbacks: { onSuccess: (result: Result) => void; onError: () => void }): void;
  }

  const jsmediatags: { Reader: typeof Reader };
  export default jsmediatags;
}
