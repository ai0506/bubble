declare module "ali-oss" {
  type ClientOptions = {
    region?: string;
    endpoint?: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    secure?: boolean;
  };

  type PutOptions = {
    headers?: Record<string, string>;
  };

  type SignatureOptions = {
    expires?: number;
    method?: string;
    "Content-Type"?: string;
  };

  class OSS {
    constructor(options: ClientOptions);
    put(name: string, file: Buffer | Uint8Array | string, options?: PutOptions): Promise<unknown>;
    delete(name: string): Promise<unknown>;
    deleteMulti(names: string[], options?: { quiet?: boolean }): Promise<unknown>;
    signatureUrl(name: string, options?: SignatureOptions): string;
  }

  export default OSS;
}
