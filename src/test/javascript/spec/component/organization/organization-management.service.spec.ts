import { OrganizationManagementService } from 'app/admin/organization-management/organization-management.service';
import { Organization } from 'app/entities/organization.model';
import { MockRouter } from '../../helpers/mocks/mock-router';
import { MockSyncStorage } from '../../helpers/mocks/service/mock-sync-storage.service';
import { MockTranslateService } from '../../helpers/mocks/service/mock-translate.service';
import { getTestBed, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { LocalStorageService, SessionStorageService } from 'ngx-webstorage';
import { TranslateService } from '@ngx-translate/core';

describe('Organization Service', () => {
    let injector: TestBed;
    let service: OrganizationManagementService;
    let httpMock: HttpTestingController;
    let elemDefault: Organization;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                { provide: Router, useClass: MockRouter },
                { provide: LocalStorageService, useClass: MockSyncStorage },
                { provide: SessionStorageService, useClass: MockSyncStorage },
                { provide: TranslateService, useClass: MockTranslateService },
            ],
        });
        injector = getTestBed();
        service = injector.get(OrganizationManagementService);
        httpMock = injector.get(HttpTestingController);

        elemDefault = new Organization();
        elemDefault.id = 0;
        elemDefault.name = 'test';
        elemDefault.shortName = 'test';
        elemDefault.emailPattern = '.*@test';
    });

    it('should return an element', async () => {
        service.getOrganizationById(0).subscribe((data) => expect(data).toMatchObject({ body: elemDefault }));

        const req = httpMock.expectOne({ method: 'GET' });
        req.flush(JSON.stringify(elemDefault));
    });

    it('should return all organizations', async () => {
        const elem2 = new Organization();
        elem2.id = 1;
        elem2.name = 'test2';
        elem2.shortName = 'test2';
        const returnElement = [elemDefault, elem2];
        service.getOrganizations().subscribe((data) => expect(data).toMatchObject({ body: returnElement }));

        const req = httpMock.expectOne({ method: 'GET' });
        req.flush(JSON.stringify(returnElement));
    });

    it('should add a new Organization', async () => {
        service.add(elemDefault).subscribe((data) => expect(data).toMatchObject({ body: elemDefault }));
        const req = httpMock.expectOne({ method: 'POST' });
        req.flush(JSON.stringify(elemDefault));
    });

    it('should update an Organization', async () => {
        const updatedElem = Object.assign(
            {
                name: 'updated',
            },
            elemDefault,
        );
        service.update(updatedElem).subscribe((data) => expect(data).toMatchObject({ body: updatedElem }));
        const req = httpMock.expectOne({ method: 'PUT' });
        req.flush(JSON.stringify(elemDefault));
    });

    it('should delete an Organization', async () => {
        service.deleteOrganization(elemDefault.id!).subscribe((resp) => expect(resp.ok));
        const req = httpMock.expectOne({ method: 'DELETE' });
        req.flush({ status: 200 });
    });
});
