import { randomBytes } from 'node:crypto';

export class UpworkOAuthProvider {
  constructor(secureFile,publicBaseUrl) {
    this.file=secureFile;
    this.baseUrl=publicBaseUrl.replace(/\/$/,'');
    this.record=secureFile.read({});
    this.authorizationUrl=null;
  }
  get redirectUrl() {return `${this.baseUrl}/v1/auth/upwork/callback`;}
  get clientMetadata() {
    return {
      client_name:'Esclatech Upwork MCP Dashboard',
      redirect_uris:[this.redirectUrl],
      response_types:['code'],
      grant_types:['authorization_code','refresh_token'],
      token_endpoint_auth_method:'none'
    };
  }
  clientInformation=()=>this.record.clientInformation;
  saveClientInformation=value=>{this.record.clientInformation=value;this.#save();};
  tokens=()=>this.record.tokens;
  saveTokens=value=>{this.record.tokens=value;this.#save();};
  state=()=>{
    this.record.pendingState=randomBytes(32).toString('hex');
    this.record.pendingStartedAt=Date.now();
    this.#save();
    return this.record.pendingState;
  };
  redirectToAuthorization=url=>{this.authorizationUrl=url.toString();};
  saveCodeVerifier=value=>{this.record.codeVerifier=value;this.#save();};
  codeVerifier=()=>{
    if (!this.record.codeVerifier) throw new Error('Missing OAuth PKCE verifier');
    return this.record.codeVerifier;
  };
  validCallbackState=value=>{
    if (!value||!this.record.pendingState||Date.now()-this.record.pendingStartedAt>15*60_000) return false;
    return value===this.record.pendingState;
  };
  clearPending=()=>{
    delete this.record.pendingState;
    delete this.record.pendingStartedAt;
    delete this.record.codeVerifier;
    this.authorizationUrl=null;
    this.#save();
  };
  disconnect=()=>{this.record={};this.authorizationUrl=null;this.#save();};
  #save=()=>{this.file.write(this.record);};
}
