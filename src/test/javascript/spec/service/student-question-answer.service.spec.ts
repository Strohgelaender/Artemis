import { getTestBed, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpResponse } from '@angular/common/http';
import * as chai from 'chai';
import { take } from 'rxjs/operators';
import { StudentQuestionAnswerService } from 'app/overview/student-questions/student-question-answer/student-question-answer.service';
import { StudentQuestionAnswer } from 'app/entities/student-question-answer.model';

const expect = chai.expect;

describe('StudentQuestionAnswer Service', () => {
    let injector: TestBed;
    let service: StudentQuestionAnswerService;
    let httpMock: HttpTestingController;
    let elemDefault: StudentQuestionAnswer;
    let expectedResult: any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
        });
        expectedResult = {} as HttpResponse<StudentQuestionAnswer>;
        injector = getTestBed();
        service = injector.get(StudentQuestionAnswerService);
        httpMock = injector.get(HttpTestingController);

        elemDefault = new StudentQuestionAnswer();
        elemDefault.id = 0;
        elemDefault.answerDate = undefined;
        elemDefault.answerText = 'This is a test answer';
    });

    describe('Service methods', () => {
        it('should create a StudentQuestionAnswer', async () => {
            const returnedFromService = { ...elemDefault, id: 0 };
            const expected = { ...returnedFromService };
            service
                .create(1, new StudentQuestionAnswer())
                .pipe(take(1))
                .subscribe((resp) => (expectedResult = resp));
            const req = httpMock.expectOne({ method: 'POST' });
            req.flush(returnedFromService);
            expect(expectedResult.body).to.deep.equal(expected);
        });

        it('should update a StudentQuestionAnswer text field', async () => {
            const returnedFromService = { ...elemDefault, answerText: 'This is another test answer' };
            const expected = { ...returnedFromService };
            service
                .update(1, expected)
                .pipe(take(1))
                .subscribe((resp) => (expectedResult = resp));
            const req = httpMock.expectOne({ method: 'PUT' });
            req.flush(returnedFromService);
            expect(expectedResult.body).to.deep.equal(expected);
        });

        it('should update a StudentQuestionAnswer tutorApproved field', async () => {
            const returnedFromService = { ...elemDefault, tutorApproved: true };
            const expected = { ...returnedFromService };
            service
                .update(1, expected)
                .pipe(take(1))
                .subscribe((resp) => (expectedResult = resp));
            const req = httpMock.expectOne({ method: 'PUT' });
            req.flush(returnedFromService);
            expect(expectedResult.body).to.deep.equal(expected);
        });

        it('should delete a StudentQuestionAnswer', async () => {
            service.delete(1, 123).subscribe((resp) => (expectedResult = resp.ok));

            const req = httpMock.expectOne({ method: 'DELETE' });
            req.flush({ status: 200 });
            expect(expectedResult).to.be.true;
        });
    });

    afterEach(() => {
        httpMock.verify();
    });
});
