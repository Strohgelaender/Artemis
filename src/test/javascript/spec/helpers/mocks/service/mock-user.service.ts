import { of } from 'rxjs';
import { User } from 'app/core/user/user.model';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Authority } from 'app/shared/constants/authority.constants';

export class MockUserService {
    query(req?: any): Observable<HttpResponse<User[]>> {
        return of({
            body: [
                new User(
                    1,
                    'ga59pelTest',
                    'Alexandros',
                    'Tsakpinis',
                    'alexandros.tsakpinis@tum.de',
                    false,
                    'en',
                    [Authority.USER, Authority.ADMIN],
                    ['jira-users', 'tumuser', 'eist2019students'],
                    undefined,
                    'anonymousUser',
                    new Date('2020-03-03T09:01:43Z'),
                    'ga59pel',
                    new Date('2020-03-22T13:02:10Z'),
                ),
            ],
            headers: new HttpHeaders({
                'X-Total-Count': '1',
                link:
                    '<http://localhost:9000/api/users?pageSize=50&searchTerm=&sortingOrder=ASCENDING&sortedColumn=id&page=0&size=50>; rel="last",<http://localhost:9000/api/users?pageSize=50&searchTerm=&sortingOrder=ASCENDING&sortedColumn=id&page=0&size=50>; rel="first"',
            }),
        } as HttpResponse<User[]>);
    }

    updateLastNotificationRead(): Observable<HttpResponse<User>> {
        return of({
            body: {} as User,
            headers: new HttpHeaders(),
        } as HttpResponse<User>);
    }
}
