export interface KumaConnectionValues {
    url: string;
    username: string;
    password: string;
    token: string;
}

export const emptyKumaConnection: KumaConnectionValues = {
    url: "",
    username: "",
    password: "",
    token: "",
};
