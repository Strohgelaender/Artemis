package de.tum.in.www1.artemis.web.rest;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import de.tum.in.www1.artemis.domain.Course;
import de.tum.in.www1.artemis.domain.Organization;
import de.tum.in.www1.artemis.domain.User;
import de.tum.in.www1.artemis.service.CourseService;
import de.tum.in.www1.artemis.service.OrganizationService;
import de.tum.in.www1.artemis.service.UserService;
import de.tum.in.www1.artemis.web.rest.util.HeaderUtil;

/**
 * REST controller for managing the Organization entities
 */
@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('ADMIN')")
public class OrganizationResource {

    private final Logger log = LoggerFactory.getLogger(OrganizationResource.class);

    private static final String ENTITY_NAME = "organization";

    @Value("${jhipster.clientApp.name}")
    private String applicationName;

    @Value("${artemis.user-management.organizations.enable-multiple-organizations:#{null}}")
    private Optional<Boolean> isMultiOrganizationEnabled;

    private final OrganizationService organizationService;

    private final UserService userService;

    private final CourseService courseService;

    public OrganizationResource(OrganizationService organizationService, UserService userService, CourseService courseService) {
        this.organizationService = organizationService;
        this.userService = userService;
        this.courseService = courseService;
    }

    @PostMapping("/organizations/course/{courseId}/organization/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> addCourseToOrganization(@PathVariable Long courseId, @PathVariable Long organizationId) {
        Course course = courseService.findOne(courseId);
        organizationService.addCourseToOrganization(course, organizationId);

        return ResponseEntity.ok().headers(HeaderUtil.createEntityUpdateAlert(applicationName, true, ENTITY_NAME, course.getTitle())).build();
    }

    @DeleteMapping("/organizations/course/{courseId}/organization/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> removeCourseToOrganization(@PathVariable Long courseId, @PathVariable Long organizationId) {
        Course course = courseService.findOne(courseId);
        organizationService.removeCourseFromOrganization(course, organizationId);

        return ResponseEntity.ok().headers(HeaderUtil.createEntityDeletionAlert(applicationName, true, ENTITY_NAME, course.getTitle())).build();
    }

    @PostMapping("/organizations/user/{userLogin}/organization/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> addUserToOrganization(@PathVariable String userLogin, @PathVariable Long organizationId) {
        Optional<User> user = userService.getUserByLogin(userLogin);
        if (user.isPresent()) {
            organizationService.addUserToOrganization(user.get(), organizationId);
        }
        else {
            return ResponseEntity.notFound().headers(HeaderUtil.createAlert(applicationName, "User couldn't be found.", "userNotFound")).build();
        }

        return ResponseEntity.ok().headers(HeaderUtil.createEntityUpdateAlert(applicationName, true, ENTITY_NAME, user.get().getLogin())).build();
    }

    @DeleteMapping("/organizations/user/{userLogin}/organization/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> removeUserToOrganization(@PathVariable String userLogin, @PathVariable Long organizationId) {
        Optional<User> user = userService.getUserByLogin(userLogin);
        if (user.isPresent()) {
            organizationService.removeUserFromOrganization(user.get(), organizationId);
        }

        return ResponseEntity.ok().headers(HeaderUtil.createEntityDeletionAlert(applicationName, true, ENTITY_NAME, user.get().getLogin())).build();
    }

    @PostMapping("/organizations/create")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Organization> createOrganization(@RequestBody Organization organization) {
        Organization created = organizationService.save(organization);

        return ResponseEntity.ok().headers(HeaderUtil.createEntityCreationAlert(applicationName, true, ENTITY_NAME, created.getName())).body(created);
    }

    @PutMapping("/organizations/update")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Organization> updateOrganization(@RequestBody Organization organization) {
        if (organization.getId() != null && organizationService.findOne(organization.getId()) != null) {
            Organization updated = organizationService.save(organization);
            return ResponseEntity.ok().headers(HeaderUtil.createEntityUpdateAlert(applicationName, true, ENTITY_NAME, updated.getName())).body(updated);
        }
        else {
            return ResponseEntity.badRequest().headers(HeaderUtil.createAlert(applicationName, "The organization to update doesn't have an ID.", "NoIdProvided")).body(null);
        }
    }

    @DeleteMapping("/organizations/delete/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> deleteOrganization(@PathVariable Long organizationId) {
        Organization organization = organizationService.findOne(organizationId);
        organizationService.deleteOrganization(organization);

        return ResponseEntity.ok().headers(HeaderUtil.createEntityDeletionAlert(applicationName, true, ENTITY_NAME, organization.getName())).build();
    }
}
