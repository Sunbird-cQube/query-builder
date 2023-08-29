import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
    keyClockurl: String;
    realm: String;
    adminClientID: String;
    adminClientSecret: String;
    adminUserName: String;
    adminPassword: String;

    constructor(private httpService: HttpService, private configService: ConfigService) {
        this.keyClockurl = this.configService.get<String>('KEY_CLOCK_URL');
        this.realm = this.configService.get<String>('REALM');
        this.adminClientID = this.configService.get<String>('KEY_CLOAK_ADMIN_CLIENT_ID');
        this.adminClientSecret = this.configService.get<String>('KEY_CLOAK_ADMIN_CLIENT_SECRET');
        this.adminUserName = this.configService.get<String>('KEY_CLOAK_ADMIN_USERNAME');
        this.adminPassword = this.configService.get<String>('KEY_CLOAK_ADMIN_PASSWORD');
    }

    getUserInfoByToken(token: string) {
        const URL = `${this.keyClockurl}/realms/${this.realm}/protocol/openid-connect/userinfo`;
        
        const headers = {
            'Authorization': token,
        };
        const config: any = { headers };
        return this.httpService.post(URL, null, config).toPromise();
    }

    getAdminUserToken() {
        return new Promise(async (resolve, reject) => {
            const URL = `${this.keyClockurl}/realms/master/protocol/openid-connect/token`;
            let payload = `client_id=${this.adminClientID}&client_secret=${this.adminClientSecret}&grant_type=password&username=${this.adminUserName}&password=${this.adminPassword}`;

            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
            const config: any = { headers };
            try {
                const result: any = await this.httpService.post(URL, payload, config).toPromise();
                resolve(result.data)
            } catch(e) {
                reject("Invalid admin credentials");
            }
        });
    }

    async getRoleInfo(roleName: string) {
        try {
            const token: any = await this.getAdminUserToken();
            const URL = `${this.keyClockurl}/admin/realms/${this.realm}/roles/${roleName}`;
            const headers = {
                'Authorization': `Bearer ${token?.access_token}`,
            };
            const config: any = { headers };
            return this.httpService.get(URL, config).toPromise();
        } catch(e) {
            return e;
        }
    }

    async getAllowedReportsOfUser(token: string) {
        let userInfoRes: any = await this.getUserInfoByToken(token);
        let userRoles = userInfoRes?.data?.realm_access?.roles;
        let userId = userInfoRes.data.sub
        let allowedReports = [];
        if (userRoles.length > 0) {
            for (let i = 0; i < userRoles.length; i++) {
                let roleInfoRes: any = await this.getRoleInfo(userRoles[i]);
                let roleInfo = roleInfoRes?.data;
                if (roleInfo && roleInfo.attributes && roleInfo.attributes.reports && roleInfo.attributes.reports.length > 0) {
                    let reports = roleInfo.attributes.reports;
                    allowedReports = [...allowedReports, ...reports];
                }
            }
        }

        return {
            userInfo: userInfoRes.data,
            allowedReports,
            userRoles,
            userId: userId
        };
    }

    async getUserAttributes(userId: string) {
        const token: any = await this.getAdminUserToken();
        const headers = {
            'Authorization': `Bearer ${token?.access_token}`,
        };
        const config: any = { headers };
        const URL = `${process.env.KEY_CLOCK_URL}/admin/realms/${process.env.REALM}/users/${userId}`;
        const results = this.httpService.get(URL, config).toPromise();
        console.log(results)
    }

    async getClientScopes() {
        try {
            const token: any = await this.getAdminUserToken();
            const headers = {
                'Authorization': `Bearer ${token?.access_token}`,
            };
            const config: any = { headers };
            const URL = `${process.env.KEY_CLOCK_URL}/admin/realms/${process.env.REALM}/client-scopes`
            return this.httpService.get(URL, config).toPromise();
        }
        catch (e) {
            return e;
        }
    }

    async updateRealmRolesInfo(clientScopesId: any, realmRolesMapperId: any, payload: any) {
        try {
            const token: any = await this.getAdminUserToken();
            const headers = {
                'Authorization': `Bearer ${token?.access_token}`,
            };
            const config: any = { headers };
            const URL = `${this.keyClockurl}/admin/realms/${this.realm}/client-scopes/${clientScopesId}/protocol-mappers/models/${realmRolesMapperId}`;
            return this.httpService.put(URL, payload, config).toPromise();
        }
        catch (e) {
            return e;
        }
    }
}
