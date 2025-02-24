import { Course } from 'app/entities/course.model';
import * as sinon from 'sinon';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApollonDiagramService } from 'app/exercises/quiz/manage/apollon-diagrams/apollon-diagram.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MockProvider } from 'ng-mocks';
import { MockNgbModalService } from '../../helpers/mocks/service/mock-ngb-modal.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { JhiAlertService } from 'ng-jhipster';
import { SortService } from 'app/shared/service/sort.service';
import { ApollonDiagramListComponent } from 'app/exercises/quiz/manage/apollon-diagrams/apollon-diagram-list.component';
import { ApollonDiagram } from 'app/entities/apollon-diagram.model';
import { UMLDiagramType } from 'app/entities/modeling-exercise.model';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpResponse } from '@angular/common/http';
import * as _ from 'lodash';
import { CourseManagementService } from 'app/course/manage/course-management.service';
import { AccountService } from 'app/core/auth/account.service';

describe('ApollonDiagramList Component', () => {
    let apollonDiagramService: ApollonDiagramService;
    let courseService: CourseManagementService;
    let fixture: ComponentFixture<ApollonDiagramListComponent>;
    const sandbox = sinon.createSandbox();
    const course: Course = { id: 123 } as Course;

    beforeEach(() => {
        const route = ({ params: of({ courseId: 123 }), snapshot: { paramMap: convertToParamMap({ courseId: course.id }) } } as any) as ActivatedRoute;

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            declarations: [ApollonDiagramListComponent],
            providers: [
                JhiAlertService,
                ApollonDiagramService,
                MockProvider(SortService),
                { provide: NgbModal, useClass: MockNgbModalService },
                { provide: ActivatedRoute, useValue: route },
                MockProvider(CourseManagementService),
                MockProvider(AccountService),
            ],
            schemas: [],
        })
            .overrideTemplate(ApollonDiagramListComponent, '')
            .compileComponents()
            .then(() => {
                fixture = TestBed.createComponent(ApollonDiagramListComponent);
                const injector = fixture.debugElement.injector;
                apollonDiagramService = injector.get(ApollonDiagramService);
                courseService = injector.get(CourseManagementService);
            });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('ngOnInit', () => {
        const apollonDiagrams: ApollonDiagram[] = [new ApollonDiagram(UMLDiagramType.ClassDiagram, course.id!), new ApollonDiagram(UMLDiagramType.ActivityDiagram, course.id!)];
        const diagramResponse: HttpResponse<ApollonDiagram[]> = new HttpResponse({ body: apollonDiagrams });
        const courseResponse: HttpResponse<Course> = new HttpResponse({ body: course });

        sandbox.stub(apollonDiagramService, 'getDiagramsByCourse').returns(of(diagramResponse));
        sandbox.stub(courseService, 'find').returns(of(courseResponse));

        // test
        fixture.componentInstance.ngOnInit();
        expect(_.isEqual(fixture.componentInstance.apollonDiagrams, apollonDiagrams)).toBeTruthy();
    });

    it('delete', () => {
        // setup
        const response: HttpResponse<void> = new HttpResponse();
        sandbox.stub(apollonDiagramService, 'delete').returns(of(response));

        const apollonDiagrams = [];
        for (let i = 0; i < 3; i++) {
            const apollonDiagram = new ApollonDiagram(UMLDiagramType.ClassDiagram, course.id!);
            apollonDiagram.id = i;
            apollonDiagrams.push(apollonDiagram);
        }

        const diagramToDelete = apollonDiagrams[0];
        fixture.componentInstance.apollonDiagrams = apollonDiagrams;
        fixture.componentInstance.delete(diagramToDelete);
        expect(fixture.componentInstance.apollonDiagrams.find((diagram) => diagram.id === diagramToDelete.id)).toBeFalsy();
    });
});
