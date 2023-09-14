import { Body, Controller, Get, Post, Query, Res, Req, UseGuards, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { Request, Response, response } from 'express';
import { MetricCsvService } from './services/metric-csv/metric-csv.service';
import * as jwt from 'jsonwebtoken';
import { UpdatedDateService } from './services/updated-date/updated-date.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AuthenticatedUser, Public, Roles } from 'nest-keycloak-connect';
import { UserService } from './services/user/user.service';


@Controller()
export class AppController {
    constructor(private readonly appService: AppService, private databaseService: DatabaseService, private metricService: MetricCsvService,
        private updatesDate: UpdatedDateService, private configService: ConfigService, private httpService: HttpService, private userService: UserService) {
    }

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('generatejwt')
    testJwt(@Res() res: Response): any {
        let jwtSecretKey = process.env.JWT_SECRET;
        let data = {
            time: Date(),
        }
        try {
            const token: string = jwt.sign(data, jwtSecretKey);
            if (token) {
                res.status(200).send({ token: token });
            }
            else {
                res.status(400).send("Could not generate token");
            }

        } catch (error) {
            res.status(400).send("Error Ocurred");
        }

    }

    @Post('/query')
    async executeQuery(@Body() body: any, @Req() request: Request, @Res() response: Response) {
        try {
            let token = request.headers.authorization;
            let { allowedReports } = await this.userService.getAllowedReportsOfUser(token);
            let result = await this.databaseService.executeQuery(body?.query, null, allowedReports);
            response.status(200).send(result)
        }
        catch (e) {
            console.error('execute-query-impl: ', e.message);
            response.status(500).send("Error running SQL query: " + e.message)
            throw new Error(e);
        }
    }

    @Get('/metric')
    async csvtoJson(@Req() request: Request, @Res() response: Response, @AuthenticatedUser() user: any) {
        try {
            let token = request.headers.authorization;
            let { allowedReports } = await this.userService.getAllowedReportsOfUser(token);
            let result = await this.metricService.convertCsvToJson(allowedReports);
            if (result.code == 400) {
                response.status(400).send({ message: result.error });
            } else {
                response.status(200).send({ message: result.message, data: result.response });
            }
        } catch (e) {
            console.error('ingestion.controller.csvtojson: ', e);
            response.status(400).send({ message: e.error || e.message });
        }
    }

    //     @Get('lastModified')
    //   async getLastModified(): Promise<Date> {
    //     return this.s3Service.getLastModified();
    //   }


    @Get('lastmodified')
    async getFileStatus(@Query() query: any, @Res() response: Response) {
        try {
            let result: any = await this.updatesDate.getLastModified(query);
            if (result.code == 400) {
                response.status(400).send({ "message": result.error });
            } else {
                response.status(200).send({ "fileMetaData": result.response });
            }
        }
        catch (e) {
            console.error('get-filestatus-impl: ', e.message);
            throw new Error(e);
        }
    }


    @Post('login')
    @Public()
    async login(@Body() inputData: any, @Res() response: Response): Promise<any> {
        const keyClockurl = this.configService.get<String>('KEY_CLOCK_URL');
        const realm = this.configService.get<String>('REALM');
        const client_id = this.configService.get<string>('KEY_CLOAK_CLIENT_ID');
        const client_secret = this.configService.get<string>('KEY_CLOAK_SECRET');
        const username = inputData.username;
        const password = inputData.password;
        try {
            if (username && password) {
                // let payload = {
                //     client_id: client_id, client_secret: client_secret, grant_type: 'password', username: username, password: password
                // }
                let payload = `client_id=${client_id}&client_secret=${client_secret}&grant_type=password&username=${username}&password=${password}`

                const headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                };
                const config: any = { headers };
                const URL = `${keyClockurl}/realms/${realm}/protocol/openid-connect/token`;
                const result: any = await this.httpService.post(URL, payload, config).toPromise();
                if (result) {
                    let { allowedReports, userRoles, userId } = await this.userService.getAllowedReportsOfUser(`Bearer ${result.data.access_token}`);
                    result.data = {
                        ...result.data,
                        program_access: allowedReports,
                        roles: userRoles,
                        userId
                    }
                    response.status(200).send(result.data)
                }
                else {
                    response.status(401).send(result.data)
                }
                // this.httpService.post(URL, payload, { headers: headersRequest }).subscribe();
            }
            else {
                response.status(401)
            }
        } catch (error) {
            console.log('keyClock.impl.service', error.message);
            response.status(401).send({ error: error.message })
        }
    }

    @Post('admin/login')
    @Public()
    async adminLogin(@Body() inputData: any, @Res() response: Response): Promise<any> {
        const keyClockurl = this.configService.get<String>('KEY_CLOCK_URL');
        const realm = this.configService.get<String>('REALM');
        const client_id = this.configService.get<string>('KEY_CLOAK_CLIENT_ID');
        const client_secret = this.configService.get<string>('KEY_CLOAK_SECRET');
        const username = inputData.username;
        const password = inputData.password;
        try {
            if (username && password) {
                // let payload = {
                //     client_id: client_id, client_secret: client_secret, grant_type: 'password', username: username, password: password
                // }
                let payload = `client_id=${client_id}&client_secret=${client_secret}&grant_type=password&username=${username}&password=${password}`

                const headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                };
                const config: any = { headers };
                const URL = `${keyClockurl}/realms/${realm}/protocol/openid-connect/token`;
                const result: any = await this.httpService.post(URL, payload, config).toPromise();
                if (result) {
                    let { allowedReports, userRoles } = await this.userService.getAllowedReportsOfUser(`Bearer ${result.data.access_token}`);
                    result.data = {
                        ...result.data,
                        program_access: allowedReports,
                        roles: userRoles
                    }
                    
                    if (userRoles.indexOf("admin") > -1) {
                        response.status(200).send(result.data)
                    } else {
                        response.status(401).send({
                            message: "Your account doesn't have Administrator priviliges"
                        })
                    }
                }
                else {
                    response.status(401).send(result.data)
                }
                // this.httpService.post(URL, payload, { headers: headersRequest }).subscribe();
            }
            else {
                response.status(401)
            }
        } catch (error) {
            console.log('keyClock.impl.service', error.message);
            response.status(401).send({ error: error.message })
        }
    }

    @Post('refresh_token')
    async refreshToken(@Body() inputData: any, @Res() response: Response): Promise<any> {
        const keyClockurl = this.configService.get<String>('KEY_CLOCK_URL');
        const realm = this.configService.get<String>('REALM');
        const client_id = this.configService.get<string>('KEY_CLOAK_CLIENT_ID');
        const client_secret = this.configService.get<string>('KEY_CLOAK_SECRET');
        const refreshToken = inputData.refresh_token;
        try {
            let payload = `client_id=${client_id}&client_secret=${client_secret}&grant_type=refresh_token&refresh_token=${refreshToken}`
            let headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
            const URL = `${keyClockurl}/realms/${realm}/protocol/openid-connect/token`;
            const config: any = { headers };
            const result: any = await this.httpService.post(URL, payload, config).toPromise();
            if (result) {
                response.status(200).send(result.data);
            }
            else {
                response.status(401).send(result.data)
            }
        }
        catch (error) {
            console.log('keyClock.impl.service', error.message);
            response.status(401).send({ error: error.message })
        }

    }

    @Get('getUserAttributes/:userId')
    // @Public()
    async getUserAttributes(@Res() response: any, @Param('userId') userId: any): Promise<any> {
        try {
            const token: any = await this.userService.getAdminUserToken();
            const headers = {
                'Authorization': `Bearer ${token?.access_token}`,
            };
            const config: any = { headers };
            const URL = `${process.env.KEY_CLOCK_URL}/admin/realms/${process.env.REALM}/users/${userId}`;
            const results = await this.httpService.get(URL, config).toPromise()
            let details = results?.data?.attributes
            if(details && Object.keys(details).length > 0) {
                // preferences = JSON.parse(results.data.attributes)
                Object.keys(details).map(key => {
                    details[key] = details[key]?.[0] ? JSON.parse(details[key][0]) : ''
                })
            }
            response.send({
                details
            })
        }
        catch (error) {
            console.error('execute-userAttr-impl: ', error.message);
            response.status(500).send("Error: " + error.message);
            throw new Error(error);
        }
    }

    @Post('setUserAttributes')
    // @Public()
    async setUserAttributes(@Body() inputData: any, @Res() response: any) {
        try {
            let details = inputData.details;
            Object.keys(details).map(key => {
                details[key] = [JSON.stringify(details[key])]
            })
            const userId = inputData.userId;
            const payload = {
                "attributes": details
            }
            await this.userService.setUserAttributes(userId, payload);
            response.status(200).send()
        }
        catch (error) {
            console.error('execute-userAttr-impl: ', error.message);
            response.status(500).send("Error: " + error.message);
            throw new Error(error);
        }
    }

    @Get('addUserInfo')
    // @Public()
    async addUserInfo(@Res() response: any, @Req() request: any) {
        try {
            const clientScopesRes = await this.userService.getClientScopes();
            const clientScopes = clientScopesRes?.data
            const rolesClientScope = clientScopes.find((obj: any) => {
                return obj.name === 'roles'
            });
            const rolesProtocolMappers = rolesClientScope?.protocolMappers
            let realmRolesProtocolMappers = rolesProtocolMappers.find((obj: any) => {
                return obj.name === 'realm roles'
            });
            const payload = {

            }
            realmRolesProtocolMappers = {
                ...realmRolesProtocolMappers,
                config: {
                    ...realmRolesProtocolMappers.config,
                    "userinfo.token.claim": "true"
                }
            }

            const results = await this.userService.updateRealmRolesInfo(rolesClientScope.id, realmRolesProtocolMappers.id, realmRolesProtocolMappers)
            response.send(results.data)
        }
        catch (error) {
            console.error('execute-query-impl: ', error.message);
            response.status(500).send("Error: " + error.message);
            throw new Error(error);
        }
    }

    @Post('logout')
    async logout(@Body() inputData: any, @Res() response: Response): Promise<any> {
        const keyClockurl = this.configService.get<String>('KEY_CLOCK_URL');
        const realm = this.configService.get<String>('REALM');
        const client_id = this.configService.get<string>('KEY_CLOAK_CLIENT_ID');
        const refreshToken = inputData.refresh_token;
        try {
            let payload = `client_id=${client_id}&refresh_token=${refreshToken}`;
            console.log(payload)
            let headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
            const URL = `${keyClockurl}/realms/${realm}/protocol/openid-connect/logout`;
            const config: any = { headers };
            const result: any = await this.httpService.post(URL, payload, config).toPromise();
            if (result) {
                response.status(200).send(result.data);
            }
            else {
                response.status(401).send(result.data)
            }
        }
        catch (error) {
            console.log('keyClock.impl.service', error.message);
            response.status(401).send({ error: error.message })
        }

    }

    @Post('/captureTelemetry')
    @Public()
    async captureTelemetry(@Body() inputData: any, @Res() response:any){
        try {
            let getJWT = await this.httpService.get(`${process.env.INGESTION_URL}/generatejwt`).toPromise()
            if(getJWT.data){
                let body = 
                    {
                        "event_name": "telemetry",
                        "event": inputData?.data,
                        "isTelemetryWritingEnd": inputData?.isTelemetryWritingEnd
                    }
                let headers = {
                    'Content-Type': 'application/json',
                    'Authorization' : `Bearer ${getJWT.data}`
                }
                let ingestEvent = await this.httpService.post(`${process.env.INGESTION_URL}/telemetryEvent`,body,{headers}).toPromise();                    
                if(ingestEvent){
                    response.status(200).send({message:"stored telemetry into file"})
                }
            }
        } catch (error) {
            console.log('captureTelemetry.impl.service', error.message);
            response.status(401).send({ error: error.message })
        }
    }
}
