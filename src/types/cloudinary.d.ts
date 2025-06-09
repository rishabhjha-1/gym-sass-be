declare module 'cloudinary' {
    const cloudinary: {
        config: (config: {
            cloud_name: string;
            api_key: string;
            api_secret: string;
        }) => void;
        v2: {
            uploader: {
                upload: (file: string, options?: any) => Promise<any>;
                destroy: (public_id: string, options?: any) => Promise<any>;
            };
        };
    };
    export default cloudinary;
} 